// src/core/jobs/jobs.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { ScheduleAssignment } from '@/database/entities/scheduling/schedule-assignment.entity';
import { ScheduleRun } from '@/database/entities/scheduling/schedule-run.entity';
import { ScheduleJob, ScheduleJobStatus } from '@/database/entities/orchestration/schedule-job.entity';
import { ScheduleArtifact, ScheduleArtifactType } from '@/database/entities/orchestration/schedule-artifact.entity';
import { Worker } from '@/database/entities/workers/worker.entity';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';

import { CreateJobDto } from './dto/create-job.dto';
import { JobsRunnerService } from './jobs-runner.service';

type PreviewAssignment = {
  workerId: string;
  date: string;
  shiftCode: string;
  shiftOrder?: number;
  isOvertime?: boolean;
  source?: string;
  attributes?: Record<string, any>;
};
type NewAssignmentRow = {
  schedule_id: string;
  schedule_run_id: string;
  worker_id: string;
  date: string;
  shift_code: string;
  shift_order: number;
  is_overtime: boolean;
  source: string;
  attributes: Record<string, any>;
};

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Schedule) private readonly schedulesRepo: Repository<Schedule>,
    @InjectRepository(ScheduleAssignment) private readonly assignmentsRepo: Repository<ScheduleAssignment>,
    @InjectRepository(ScheduleJob) private readonly jobsRepo: Repository<ScheduleJob>,
    @InjectRepository(ScheduleArtifact) private readonly artifactsRepo: Repository<ScheduleArtifact>,
    @InjectRepository(Worker) private readonly workersRepo: Repository<Worker>,
    private readonly runner: JobsRunnerService,
    private readonly s3Artifacts: S3ArtifactsService,
  ) {}

  private assignmentKey(workerId: string, date: string, shiftOrder?: number, shiftCode?: string) {
    const orderPart = Number.isFinite(shiftOrder) ? String(Number(shiftOrder)) : '';
    const shiftPart = (shiftCode ?? '').toUpperCase();
    return `${workerId}__${date}__${orderPart || shiftPart}`;
  }

  async createJob(
    scheduleId: string,
    dto: CreateJobDto,
    idempotencyKey: string | null,
    opts?: { enqueueLocalRunner?: boolean },
    callerOrgId?: number,
  ) {
    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (!schedule.unit_id) throw new BadRequestException('Solver jobs require a unit-scoped schedule');

    // ISO 27001:2022 A.5.15 — verify schedule belongs to caller's org
    if (callerOrgId && String(schedule.organization_id) !== String(callerOrgId)) {
      throw new ForbiddenException('Access denied');
    }

    // Better idempotency: scope by org + unit + key
    if (idempotencyKey) {
      const existing = await this.jobsRepo.findOne({
        where: {
          organization_id: schedule.organization_id,
          unit_id: schedule.unit_id,
          idempotency_key: idempotencyKey,
        },
      });

      if (existing?.attributes?.scheduleId === scheduleId) {
        return {
          job: {
            id: existing.id,
            scheduleId,
            state: existing.status,
            createdAt: existing.created_at.toISOString(),
          },
        };
      }
    }

    const job = this.jobsRepo.create({
      organization_id: schedule.organization_id,
      unit_id: schedule.unit_id,
      requested_by: schedule.created_by,
      idempotency_key: idempotencyKey,
      status: ScheduleJobStatus.REQUESTED,
      start_date: dto.startDate,
      end_date: dto.endDate,
      chosen_plan: null,
      final_schedule_id: null,
      error_code: null,
      error_message: null,
      attributes: {
        scheduleId,
        strategy: dto.strategy ?? null,
        solverConfig: dto.solverConfig ?? null,
        options: dto.options ?? null,
        notes: dto.notes ?? null,
      },
    });

    const saved = await this.jobsRepo.save(job);

    // Link schedule -> job for polling UI
    schedule.job_id = saved.id;
    await this.schedulesRepo.save(schedule);

    const enqueueLocal = opts?.enqueueLocalRunner ?? false;
    if (enqueueLocal) this.runner.enqueue(saved.id);


    return {
      job: {
        id: saved.id,
        scheduleId,
        state: saved.status,
        createdAt: saved.created_at.toISOString(),
      },
    };
  }

  private assertJobOwnership(job: ScheduleJob, callerOrgId?: number) {
    if (callerOrgId && String(job.organization_id) !== String(callerOrgId)) {
      throw new ForbiddenException('Access denied');
    }
  }

  async getJob(jobId: string, callerOrgId?: number) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    // ISO 27001:2022 A.5.15
    this.assertJobOwnership(job, callerOrgId);

    return {
      job: {
        id: job.id,
        scheduleId: job.attributes?.scheduleId ?? null,
        state: job.status,
        phase: this.phaseFromStatus(job.status),
        createdAt: job.created_at.toISOString(),
        updatedAt: job.updated_at.toISOString(),
        errorCode: job.error_code,
        errorMessage: job.error_message,
      },
    };
  }

  async listArtifacts(jobId: string, callerOrgId?: number) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    this.assertJobOwnership(job, callerOrgId);

    const artifacts = await this.artifactsRepo.find({ where: { job_id: jobId }, order: { created_at: 'ASC' } });

    return {
      artifacts: artifacts.map((a) => ({
        id: a.id,
        type: a.type,
        storage: {
          provider: a.storage_provider,
          bucket: a.bucket,
          objectKey: a.object_key,
          contentType: a.content_type,
        },
        metadata: a.metadata,
        createdAt: a.created_at.toISOString(),
      })),
    };
  }

  async getSolverPayload(jobId: string, callerOrgId?: number) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    this.assertJobOwnership(job, callerOrgId);

    const normalizedArtifact = await this.artifactsRepo.findOne({
      where: {
        job_id: jobId,
        type: ScheduleArtifactType.NORMALIZED_INPUT,
      },
      order: { created_at: 'DESC' },
    });

    if (!normalizedArtifact) {
      throw new NotFoundException('No normalized solver payload artifact found for this job');
    }

    const normalizedObj = await this.readArtifactJson(normalizedArtifact);
    if (!normalizedObj || typeof normalizedObj !== 'object') {
      throw new NotFoundException('Normalized solver payload artifact is missing or unreadable');
    }

    const payload = (normalizedObj as any).payload ?? normalizedObj;

    return {
      jobId,
      scheduleId: job.attributes?.scheduleId ?? null,
      artifact: {
        id: normalizedArtifact.id,
        type: normalizedArtifact.type,
        storage: {
          provider: normalizedArtifact.storage_provider,
          bucket: normalizedArtifact.bucket,
          objectKey: normalizedArtifact.object_key,
          contentType: normalizedArtifact.content_type,
        },
        metadata: normalizedArtifact.metadata,
        createdAt: normalizedArtifact.created_at.toISOString(),
      },
      payload,
    };
  }

  async preview(jobId: string, callerOrgId?: number) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    this.assertJobOwnership(job, callerOrgId);

    // PRIORITY 1: Always try to rebuild from artifact first (has authoritative solver nurse_stats)
    const rebuilt = await this.rebuildPreviewFromArtifacts(jobId);
    if (rebuilt && (rebuilt.assignments?.length > 0 || rebuilt.nurseStats?.length > 0)) {
      // Cache the artifact version in job attributes (update if different)
      if (!job.attributes?.preview || job.attributes.preview.summary?.note !== rebuilt.summary?.note) {
        job.attributes = {
          ...(job.attributes ?? {}),
          preview: rebuilt,
        };
        await this.jobsRepo.save(job);
      }
      return rebuilt;
    }

    // PRIORITY 2: Return existing preview if it was saved (only if artifact rebuild failed)
    const existingPreview = job.attributes?.preview;
    if (
      existingPreview &&
      (
        (Array.isArray(existingPreview.assignments) && existingPreview.assignments.length > 0) ||
        (Array.isArray(existingPreview.nurseStats) && existingPreview.nurseStats.length > 0)
      )
    ) {
      return existingPreview;
    }

    // PRIORITY 3: Final fallback - reconstruct from applied DB assignments
    const fromAppliedAssignments = await this.buildPreviewFromAppliedAssignments(job);
    if (!fromAppliedAssignments) return existingPreview ?? { summary: {}, assignments: [] };

    job.attributes = {
      ...(job.attributes ?? {}),
      preview: fromAppliedAssignments,
    };
    await this.jobsRepo.save(job);
    return fromAppliedAssignments;
  }

  private async buildPreviewFromAppliedAssignments(job: ScheduleJob) {
    const scheduleId = String(job.attributes?.scheduleId ?? '');
    if (!scheduleId) return null;

    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule || !schedule.current_run_id) return null;

    const rows = await this.assignmentsRepo.find({
      where: {
        schedule_id: scheduleId,
        schedule_run_id: schedule.current_run_id,
        source: 'SOLVER',
      },
      order: { date: 'ASC' as any, id: 'ASC' as any },
    });

    if (rows.length === 0) return null;

    const workerIds = Array.from(new Set(rows.map((r) => String(r.worker_id))));
    const workers = workerIds.length
      ? await this.workersRepo.find({ where: { id: In(workerIds as any) } as any })
      : [];
    const workerById = new Map(workers.map((w) => [String(w.id), w]));

    const assignments = rows.map((r) => ({
      workerId: String(r.worker_id),
      date: String(r.date),
      shiftCode: String(r.shift_code),
      shiftOrder: Number(r.shift_order ?? 1),
      isOvertime: Boolean(r.is_overtime ?? false),
      source: 'SOLVER',
      attributes: r.attributes ?? {},
    }));

    const counters = new Map<string, { assigned: number; nights: number }>();
    for (const row of rows) {
      const workerId = String(row.worker_id);
      const curr = counters.get(workerId) ?? { assigned: 0, nights: 0 };
      curr.assigned += 1;
      if (String(row.shift_code).toUpperCase() === 'NIGHT') curr.nights += 1;
      counters.set(workerId, curr);
    }

    const nurseStats = Array.from(counters.entries()).map(([workerId, c]) => {
      const worker = workerById.get(workerId);
      const regular = Number(worker?.regular_shifts_per_period ?? 0);
      const overtime = Math.max(0, c.assigned - regular);
      return {
        workerId,
        nurseCode: worker?.worker_code ?? null,
        assignedShifts: c.assigned,
        overtime,
        nights: c.nights,
        satisfaction: 0,
      };
    });

    const totalOvertime = nurseStats.reduce((sum, s) => sum + s.overtime, 0);

    return {
      scheduleId,
      summary: {
        note: 'Preview reconstructed from applied schedule assignments',
        assignmentCount: assignments.length,
        feasible: assignments.length > 0,
        status: 'APPLIED',
        nurseCount: nurseStats.length,
        totalOvertime,
      },
      assignments,
      nurseStats,
    };
  }

  private async rebuildPreviewFromArtifacts(jobId: string) {
    const solverArtifact = await this.artifactsRepo.findOne({
      where: {
        job_id: jobId,
        type: ScheduleArtifactType.SOLVER_OUTPUT,
      },
      order: { created_at: 'DESC' },
    });

    if (!solverArtifact) return null;

    const solverObj = await this.readArtifactJson(solverArtifact);
    if (!solverObj || typeof solverObj !== 'object') return null;

    // The artifact may have nested structure: either direct result OR wrapped in output
    const output =
      (solverObj as any).result ??
      (solverObj as any).output ??
      solverObj;

    // If output itself has a result field, drill down one more level
    const actualResult =
      (output as any).result ?? output;

    const rawAssignments: any[] = Array.isArray((actualResult as any).assignments)
      ? (actualResult as any).assignments
      : [];

    const rawStats: any[] = Array.isArray((actualResult as any).nurse_stats)
      ? (actualResult as any).nurse_stats
      : [];

    const nurseStats = rawStats.map((s) => ({
      workerId: s?.workerId != null ? String(s.workerId) : (s?.worker_id != null ? String(s.worker_id) : null),
      nurseCode: s?.nurse != null ? String(s.nurse) : (s?.nurseCode != null ? String(s.nurseCode) : null),
      assignedShifts: Number(s?.assigned_shifts ?? s?.assignedShifts ?? 0),
      overtime: Number(s?.overtime ?? 0),
      nights: Number(s?.nights ?? s?.night_shifts ?? s?.nightShifts ?? 0),
      satisfaction: Number(s?.satisfaction ?? 0),
    }));

    const totalOvertime = nurseStats.reduce(
      (sum, s) => sum + (Number.isFinite(s.overtime) ? s.overtime : 0),
      0,
    );

    const assignments = rawAssignments.map((a) => ({
      workerId: a?.workerId != null ? String(a.workerId) : (a?.worker_id != null ? String(a.worker_id) : null),
      nurseCode: a?.nurse != null ? String(a.nurse) : (a?.nurseCode != null ? String(a.nurseCode) : null),
      date: String(a?.date ?? a?.day ?? ''),
      shiftCode: String(a?.shiftCode ?? a?.shift_code ?? a?.shift ?? ''),
      shiftOrder: Number(a?.shiftOrder ?? a?.shift_order ?? 1),
      isOvertime: Boolean(a?.isOvertime ?? a?.is_overtime ?? false),
      source: 'SOLVER',
      attributes: a?.attributes ?? {},
    }));

    const feasible =
      typeof (actualResult as any).feasible === 'boolean'
        ? (actualResult as any).feasible
        : Array.isArray((actualResult as any).assignments) && (actualResult as any).assignments.length > 0;

    return {
      summary: {
        note: 'Preview reconstructed from solver output artifact',
        assignmentCount: assignments.length,
        feasible,
        status: (actualResult as any).status ?? null,
        nurseCount: nurseStats.length,
        totalOvertime,
      },
      assignments,
      nurseStats,
    };
  }

  private async readArtifactJson(artifact: ScheduleArtifact): Promise<Record<string, any> | null> {
    if (artifact.storage_provider === 'db') {
      return (artifact.metadata ?? {}) as Record<string, any>;
    }

    if (!artifact.bucket || !artifact.object_key) return null;
    try {
      const json = await this.s3Artifacts.getJson({
        bucket: artifact.bucket,
        key: artifact.object_key,
      });
      return (json ?? null) as Record<string, any> | null;
    } catch {
      return null;
    }
  }

  async apply(jobId: string, overwriteManualChanges: boolean, callerOrgId?: number) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    this.assertJobOwnership(job, callerOrgId);

    if (job.status !== ScheduleJobStatus.COMPLETED) {
      throw new ConflictException('Job is not completed yet');
    }

    const scheduleId: string | undefined = job.attributes?.scheduleId;
    if (!scheduleId) throw new ConflictException('Job missing schedule linkage');

    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    const previewAssignments: PreviewAssignment[] = job.attributes?.preview?.assignments ?? [];

    const solverByKey = new Map<string, PreviewAssignment>();
    for (const pa of previewAssignments) {
      const key = this.assignmentKey(pa.workerId, pa.date, pa.shiftOrder, pa.shiftCode);
      solverByKey.set(key, pa);
    }

    const assignmentsByKey = new Map<string, NewAssignmentRow>();
    for (const pa of solverByKey.values()) {
      const shiftOrder = Number(pa.shiftOrder ?? 1);
      const isOvertime = Boolean(pa.isOvertime ?? (shiftOrder > 1));
      const key = this.assignmentKey(pa.workerId, pa.date, shiftOrder, pa.shiftCode);
      assignmentsByKey.set(key, {
        schedule_id: schedule.id,
        schedule_run_id: '',
        worker_id: pa.workerId,
        date: pa.date,
        shift_code: pa.shiftCode,
        shift_order: shiftOrder,
        is_overtime: isOvertime,
        source: pa.source ?? 'SOLVER',
        attributes: pa.attributes ?? {},
      });
    }

    let skippedManual = 0;

    if (schedule.current_run_id) {
      const manualAssignments = await this.assignmentsRepo.find({
        where: { schedule_run_id: schedule.current_run_id, source: 'MANUAL' },
      });

      for (const ma of manualAssignments) {
        const key = this.assignmentKey(String(ma.worker_id), String(ma.date), Number(ma.shift_order ?? 1), String(ma.shift_code));
        const hasSolver = solverByKey.has(key);

        if (hasSolver && overwriteManualChanges) {
          continue;
        }

        if (hasSolver && !overwriteManualChanges) {
          skippedManual += 1;
        }

        assignmentsByKey.set(key, {
          schedule_id: schedule.id,
          schedule_run_id: '',
          worker_id: ma.worker_id,
          date: ma.date,
          shift_code: ma.shift_code,
          shift_order: Number(ma.shift_order ?? 1),
          is_overtime: Boolean(ma.is_overtime ?? false),
          source: 'MANUAL',
          attributes: ma.attributes ?? {},
        });
      }
    }

    await this.assignmentsRepo.manager.transaction(async (trx) => {
      const scheduleRunsRepo = trx.getRepository(ScheduleRun);
      const assignmentsRepo = trx.getRepository(ScheduleAssignment);
      const schedulesRepo = trx.getRepository(Schedule);

      const scheduleRun = scheduleRunsRepo.create({
        schedule_id: schedule.id,
        job_id: job.id,
      });
      const savedRun = await scheduleRunsRepo.save(scheduleRun);

      const rows = Array.from(assignmentsByKey.values()).map((row) => ({
        ...row,
        schedule_run_id: savedRun.id,
      }));

      if (rows.length > 0) {
        await assignmentsRepo.insert(rows);
      }

      schedule.job_id = job.id;
      schedule.current_run_id = savedRun.id;
      await schedulesRepo.save(schedule);

    });

    const updated = Array.from(assignmentsByKey.values()).filter((a) => a.source === 'SOLVER').length;

    return {
      schedule: {
        id: schedule.id,
        status: 'READY_FOR_REVIEW',
        jobId: job.id,
      },
      updatedAssignmentsCount: updated,
      skippedManualAssignmentsCount: skippedManual,
    };
  }

  async cancel(jobId: string, callerOrgId?: number) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    this.assertJobOwnership(job, callerOrgId);

    job.status = ScheduleJobStatus.FAILED;
    job.error_code = 'CANCELLED';
    job.error_message = 'Cancelled by user';
    await this.jobsRepo.save(job);

    return { jobId: job.id, state: job.status, errorCode: job.error_code };
  }

  private phaseFromStatus(s: ScheduleJobStatus) {
    switch (s) {
      case ScheduleJobStatus.REQUESTED: return 'REQUESTED';
      case ScheduleJobStatus.VALIDATED: return 'VALIDATING';
      case ScheduleJobStatus.NORMALIZING: return 'NORMALIZING';
      case ScheduleJobStatus.SOLVING_A_STRICT: return 'STRICT_PASS';
      case ScheduleJobStatus.SOLVING_A_RELAXED: return 'RELAXED_PASS';
      case ScheduleJobStatus.SOLVING_B_MILP: return 'MILP_FALLBACK';
      case ScheduleJobStatus.EVALUATING: return 'EVALUATING';
      case ScheduleJobStatus.PERSISTING: return 'PERSISTING';
      case ScheduleJobStatus.COMPLETED: return 'COMPLETED';
      case ScheduleJobStatus.FAILED: return 'FAILED';
      default: return 'UNKNOWN';
    }
  }
}
