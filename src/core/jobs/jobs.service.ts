// src/core/jobs/jobs.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { ScheduleAssignment } from '@/database/entities/scheduling/schedule-assignment.entity';
import { ScheduleJob, ScheduleJobStatus } from '@/database/entities/orchestration/schedule-job.entity';
import { ScheduleArtifact } from '@/database/entities/orchestration/schedule-artifact.entity';

import { CreateJobDto } from './dto/create-job.dto';
import { JobsRunnerService } from './jobs-runner.service';

type PreviewAssignment = { workerId: string; date: string; shiftCode: string };

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Schedule) private readonly schedulesRepo: Repository<Schedule>,
    @InjectRepository(ScheduleAssignment) private readonly assignmentsRepo: Repository<ScheduleAssignment>,
    @InjectRepository(ScheduleJob) private readonly jobsRepo: Repository<ScheduleJob>,
    @InjectRepository(ScheduleArtifact) private readonly artifactsRepo: Repository<ScheduleArtifact>,
    private readonly runner: JobsRunnerService,
  ) {}

  async createJob(scheduleId: string, dto: CreateJobDto, idempotencyKey: string | null) {
    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule not found');

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

    // ✅ Phase 2A: actually run pipeline locally (Step Functions later)
    this.runner.enqueue(saved.id);

    return {
      job: {
        id: saved.id,
        scheduleId,
        state: saved.status,
        createdAt: saved.created_at.toISOString(),
      },
    };
  }

  async getJob(jobId: string) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

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

  async listArtifacts(jobId: string) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

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

  async preview(jobId: string) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    return job.attributes?.preview ?? { summary: {}, assignments: [] };
  }

  async apply(jobId: string, overwriteManualChanges: boolean) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    if (job.status !== ScheduleJobStatus.COMPLETED) {
      throw new ConflictException('Job is not completed yet');
    }

    const scheduleId: string | undefined = job.attributes?.scheduleId;
    if (!scheduleId) throw new ConflictException('Job missing schedule linkage');

    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    const previewAssignments: PreviewAssignment[] = job.attributes?.preview?.assignments ?? [];

    let updated = 0;
    let skippedManual = 0;

    for (const pa of previewAssignments) {
      const existing = await this.assignmentsRepo.findOne({
        where: { schedule_id: schedule.id, worker_id: pa.workerId, date: pa.date },
      });

      if (existing) {
        if (existing.source === 'MANUAL' && !overwriteManualChanges) {
          skippedManual += 1;
          continue;
        }
        existing.shift_code = pa.shiftCode;
        existing.source = 'SOLVER';
        await this.assignmentsRepo.save(existing);
        updated += 1;
      } else {
        const created = this.assignmentsRepo.create({
          schedule_id: schedule.id,
          worker_id: pa.workerId,
          date: pa.date,
          shift_code: pa.shiftCode,
          source: 'SOLVER',
          attributes: {},
        });
        await this.assignmentsRepo.save(created);
        updated += 1;
      }
    }

    schedule.job_id = job.id;
    await this.schedulesRepo.save(schedule);

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

  async cancel(jobId: string) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    // Phase 2A: mark failed-cancelled (since enum has no CANCELLED)
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
