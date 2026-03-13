// src/core/workers/workers.service.ts
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';
import {
  ScheduleArtifact,
  ScheduleArtifactType,
} from '@/database/entities/orchestration/schedule-artifact.entity';
import {
  ScheduleJob,
} from '@/database/entities/orchestration/schedule-job.entity';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';
import { PutWorkerPreferencesDto } from './dto/put-preferences.dto';

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);

  constructor(
    @InjectRepository(Worker) private readonly workersRepo: Repository<Worker>,
    @InjectRepository(WorkerPreference) private readonly prefsRepo: Repository<WorkerPreference>,
    @InjectRepository(ScheduleJob) private readonly jobsRepo: Repository<ScheduleJob>,
    @InjectRepository(ScheduleArtifact)
    private readonly artifactsRepo: Repository<ScheduleArtifact>,
    private readonly s3Artifacts: S3ArtifactsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async listWorkers(unitId: string, search: string | null) {
    type Result = { workers: Array<{ id: any; fullName: string; employmentType: any; averageSatisfaction: number | null }> };
    const cacheKey = `workers:list:${unitId}:${search ?? ''}`;
    const cached = await this.cache.get<Result>(cacheKey);
    if (cached) return cached;

    const where: any = { primary_unit_id: unitId, is_active: true };

    if (search) {
      where.full_name = ILike(`%${search}%`);
    }

    const workers = await this.workersRepo.find({ where, order: { full_name: 'ASC' } });

    const workerIds = workers.map((w) => String(w.id));
    const prefRows = workerIds.length
      ? await this.prefsRepo.find({ where: { worker_id: In(workerIds) as any } as any })
      : [];

    const avgSatisfactionByWorkerId = new Map<string, number | null>();
    for (const pref of prefRows) {
      const attrs = (pref.attributes ?? {}) as Record<string, any>;
      const raw = attrs.averageSatisfaction ?? attrs.average_satisfaction ?? null;

      if (raw == null) {
        avgSatisfactionByWorkerId.set(String(pref.worker_id), null);
        continue;
      }

      const n = Number(raw);
      avgSatisfactionByWorkerId.set(String(pref.worker_id), Number.isFinite(n) ? n : null);
    }

    const result = {
      workers: workers.map((w) => ({
        id: w.id,
        fullName: w.full_name,
        employmentType: w.employment_type,
        averageSatisfaction: avgSatisfactionByWorkerId.get(String(w.id)) ?? null,
      })),
    };

    await this.cache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  async upsertPreferences(workerId: string, dto: PutWorkerPreferencesDto) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    let pref = await this.prefsRepo.findOne({ where: { worker_id: workerId } });

    if (!pref) {
      pref = this.prefsRepo.create({
        worker_id: workerId,
        prefers_day_shifts: dto.prefersDayShifts ?? null,
        prefers_night_shifts: dto.prefersNightShifts ?? null,
        max_consecutive_work_days: dto.maxConsecutiveWorkDays ?? null,
        max_consecutive_night_shifts: dto.maxConsecutiveNightShifts ?? null,
        preference_pattern_json: dto.preferencePatternJson ?? {},
        attributes: dto.attributes ?? {},
      });
    } else {
      pref.prefers_day_shifts = dto.prefersDayShifts ?? pref.prefers_day_shifts;
      pref.prefers_night_shifts = dto.prefersNightShifts ?? pref.prefers_night_shifts;
      pref.max_consecutive_work_days = dto.maxConsecutiveWorkDays ?? pref.max_consecutive_work_days;
      pref.max_consecutive_night_shifts = dto.maxConsecutiveNightShifts ?? pref.max_consecutive_night_shifts;
      pref.preference_pattern_json = dto.preferencePatternJson ?? pref.preference_pattern_json;
      pref.attributes = dto.attributes ?? pref.attributes;
    }

    const saved = await this.prefsRepo.save(pref);

    // Invalidate worker list and KPI caches for this worker's unit
    const unitId = worker.primary_unit_id ? String(worker.primary_unit_id) : null;
    if (unitId) {
      await Promise.all([
        this.cache.del(`workers:list:${unitId}:`),
        this.cache.del(`kpi:${unitId}::`),
      ]);
    }

    return {
      workerId,
      updatedAt: saved.updated_at?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  async getOverallAverageSatisfaction(unitId: string): Promise<number | null> {
    const summary = await this.getDashboardKpiSummary(unitId, {
      startDate: null,
      endDate: null,
    });
    return summary?.metrics?.satisfaction?.average ?? null;
  }

  async getDashboardKpiSummary(
    unitId: string,
    window: { startDate: string | null; endDate: string | null } = { startDate: null, endDate: null },
  ): Promise<{
    schema: 'DashboardKpi.v1';
    unitId: string;
    source: string;
    window: { startDate: string | null; endDate: string | null };
    metrics: {
      satisfaction: { average: number | null };
      fairness: {
        workloadStdDev: number | null;
        workloadMin: number | null;
        workloadMax: number | null;
        workerCount: number | null;
      };
    };
  }> {
    const { startDate, endDate } = window;

    const cacheKey = `kpi:${unitId}:${startDate ?? ''}:${endDate ?? ''}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const fromArtifacts = await this.readKpiFromArtifacts(unitId, startDate, endDate);
    if (fromArtifacts) {
      const result = {
        schema: 'DashboardKpi.v1' as const,
        unitId: String(unitId),
        source: fromArtifacts.source,
        window: {
          startDate: startDate ?? fromArtifacts.windowStartDate ?? null,
          endDate: endDate ?? fromArtifacts.windowEndDate ?? null,
        },
        metrics: {
          satisfaction: {
            average: fromArtifacts.averageSatisfaction,
          },
          fairness: {
            workloadStdDev: fromArtifacts.fairness.workloadStdDev,
            workloadMin: fromArtifacts.fairness.workloadMin,
            workloadMax: fromArtifacts.fairness.workloadMax,
            workerCount: fromArtifacts.fairness.workerCount,
          },
        },
      };
      await this.cache.set(cacheKey, result, 5 * 60 * 1000);
      return result;
    }

    const fromRuns = await this.readKpiFromSolverRuns(unitId);
    if (fromRuns) {
      const result = {
        schema: 'DashboardKpi.v1' as const,
        unitId: String(unitId),
        source: 'solver_runs',
        window: {
          startDate: startDate ?? null,
          endDate: endDate ?? null,
        },
        metrics: {
          satisfaction: { average: fromRuns.averageSatisfaction },
          fairness: {
            workloadStdDev: fromRuns.fairness.workloadStdDev,
            workloadMin: fromRuns.fairness.workloadMin,
            workloadMax: fromRuns.fairness.workloadMax,
            workerCount: fromRuns.fairness.workerCount,
          },
        },
      };
      await this.cache.set(cacheKey, result, 5 * 60 * 1000);
      return result;
    }

    const fromLatestRun = await this.deriveKpiFromLatestRun(unitId, startDate, endDate);
    if (fromLatestRun) {
      const result = {
        schema: 'DashboardKpi.v1' as const,
        unitId: String(unitId),
        source: 'latest_schedule_run',
        window: {
          startDate: startDate ?? null,
          endDate: endDate ?? null,
        },
        metrics: {
          satisfaction: { average: fromLatestRun.averageSatisfaction },
          fairness: {
            workloadStdDev: fromLatestRun.fairness.workloadStdDev,
            workloadMin: fromLatestRun.fairness.workloadMin,
            workloadMax: fromLatestRun.fairness.workloadMax,
            workerCount: fromLatestRun.fairness.workerCount,
          },
        },
      };
      await this.cache.set(cacheKey, result, 5 * 60 * 1000);
      return result;
    }

    this.logger.warn(`[KPI] unit=${unitId} no KPI summary found for dashboard`);

    return {
      schema: 'DashboardKpi.v1',
      unitId: String(unitId),
      source: 'none',
      window: {
        startDate: startDate ?? null,
        endDate: endDate ?? null,
      },
      metrics: {
        satisfaction: { average: null },
        fairness: {
          workloadStdDev: null,
          workloadMin: null,
          workloadMax: null,
          workerCount: null,
        },
      },
    };
  }

  private async readKpiFromArtifacts(
    unitId: string,
    startDate: string | null,
    endDate: string | null,
  ): Promise<{
    source: string;
    averageSatisfaction: number | null;
    fairness: {
      workloadStdDev: number | null;
      workloadMin: number | null;
      workloadMax: number | null;
      workerCount: number | null;
    };
    windowStartDate: string | null;
    windowEndDate: string | null;
  } | null> {
    const latestKpis = await this.artifactsRepo
      .createQueryBuilder('a')
      .innerJoin(ScheduleJob, 'j', 'j.id = a.job_id')
      .where('a.type = :type', { type: ScheduleArtifactType.KPI_SUMMARY })
      .andWhere('j.unit_id = :unitId', { unitId: String(unitId) })
      .orderBy('a.created_at', 'DESC')
      .limit(15)
      .getMany();

    this.logger.log(
      `[KPI] unit=${unitId} found ${latestKpis.length} KPI artifacts`,
    );

    if (!latestKpis.length) return null;

    for (const latestKpi of latestKpis) {
      const metaResult = this.extractKpiMetrics(latestKpi.metadata);
      if (
        metaResult.averageSatisfaction != null &&
        this.windowMatches(metaResult.windowStartDate, metaResult.windowEndDate, startDate, endDate)
      ) {
        this.logger.log(`[KPI] unit=${unitId} source=artifact_metadata value=${metaResult.averageSatisfaction}`);
        return {
          source: 'artifact_metadata',
          averageSatisfaction: metaResult.averageSatisfaction,
          fairness: metaResult.fairness,
          windowStartDate: metaResult.windowStartDate,
          windowEndDate: metaResult.windowEndDate,
        };
      }

      if (
        latestKpi.storage_provider?.toLowerCase() === 's3' &&
        latestKpi.bucket &&
        latestKpi.object_key
      ) {
        try {
          const json = await this.s3Artifacts.getJson({
            bucket: latestKpi.bucket,
            key: latestKpi.object_key,
          });
          const s3Result = this.extractKpiMetrics(json);
          if (
            s3Result.averageSatisfaction != null &&
            this.windowMatches(s3Result.windowStartDate, s3Result.windowEndDate, startDate, endDate)
          ) {
            this.logger.log(`[KPI] unit=${unitId} source=s3_kpi value=${s3Result.averageSatisfaction}`);
            return {
              source: 's3_kpi',
              averageSatisfaction: s3Result.averageSatisfaction,
              fairness: s3Result.fairness,
              windowStartDate: s3Result.windowStartDate,
              windowEndDate: s3Result.windowEndDate,
            };
          }
        } catch (e: any) {
          this.logger.warn(
            `[KPI] unit=${unitId} s3_kpi_read_failed bucket=${latestKpi.bucket} key=${latestKpi.object_key} err=${e?.name ?? 'Error'}:${e?.message ?? e}`,
          );
          if (this.isS3AccessDenied(e)) break;
          // continue trying older artifacts
        }
      }
    }

    return null;
  }

  private async readKpiFromSolverRuns(unitId: string): Promise<{
    averageSatisfaction: number | null;
    fairness: {
      workloadStdDev: number | null;
      workloadMin: number | null;
      workloadMax: number | null;
      workerCount: number | null;
    };
  } | null> {
    const rows: Array<{ kpis_json: any }> = await this.workersRepo.manager.query(
      `
      select sr.kpis_json
      from maywin_db.solver_runs sr
      inner join maywin_db.schedules s on s.id = sr.schedule_id
      where s.unit_id = $1::bigint
        and sr.kpis_json is not null
      order by sr.id desc
      limit 20
      `,
      [String(unitId)],
    );

    for (const row of rows ?? []) {
      const parsed = this.extractKpiMetrics(row?.kpis_json);
      if (parsed.averageSatisfaction != null) {
        return {
          averageSatisfaction: parsed.averageSatisfaction,
          fairness: parsed.fairness,
        };
      }
    }

    return null;
  }

  private extractKpiMetrics(data: any): {
    averageSatisfaction: number | null;
    fairness: {
      workloadStdDev: number | null;
      workloadMin: number | null;
      workloadMax: number | null;
      workerCount: number | null;
    };
    windowStartDate: string | null;
    windowEndDate: string | null;
  } {
    const avg = this.extractAverageSatisfaction(data);
    const fairness = this.extractFairness(data);
    return {
      averageSatisfaction: avg,
      fairness,
      windowStartDate: data?.window?.startDate ? String(data.window.startDate) : null,
      windowEndDate: data?.window?.endDate ? String(data.window.endDate) : null,
    };
  }

  private extractFairness(data: any): {
    workloadStdDev: number | null;
    workloadMin: number | null;
    workloadMax: number | null;
    workerCount: number | null;
  } {
    const std = this.toNumberOrNull(
      data?.metrics?.fairness?.workloadStdDev ??
      data?.fairness?.workloadStdDev ??
      data?.workloadStdDev ??
      null,
    );
    const min = this.toNumberOrNull(
      data?.metrics?.fairness?.workloadMin ??
      data?.fairness?.workloadMin ??
      data?.workloadMin ??
      null,
    );
    const max = this.toNumberOrNull(
      data?.metrics?.fairness?.workloadMax ??
      data?.fairness?.workloadMax ??
      data?.workloadMax ??
      null,
    );
    const count = this.toNumberOrNull(
      data?.metrics?.fairness?.workerCount ??
      data?.fairness?.workerCount ??
      data?.workerCount ??
      null,
    );

    return {
      workloadStdDev: std,
      workloadMin: min,
      workloadMax: max,
      workerCount: count,
    };
  }

  private toNumberOrNull(value: any): number | null {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private windowMatches(
    artifactStart: string | null,
    artifactEnd: string | null,
    requestedStart: string | null,
    requestedEnd: string | null,
  ): boolean {
    if (!requestedStart && !requestedEnd) return true;
    if (!artifactStart || !artifactEnd) return false;

    const aStart = String(artifactStart).slice(0, 10);
    const aEnd = String(artifactEnd).slice(0, 10);
    const rStart = requestedStart ? String(requestedStart).slice(0, 10) : null;
    const rEnd = requestedEnd ? String(requestedEnd).slice(0, 10) : null;

    if (rStart && aStart !== rStart) return false;
    if (rEnd && aEnd !== rEnd) return false;
    return true;
  }

  private async deriveKpiFromLatestRun(
    unitId: string,
    startDate: string | null,
    endDate: string | null,
  ): Promise<{
    averageSatisfaction: number | null;
    fairness: {
      workloadStdDev: number | null;
      workloadMin: number | null;
      workloadMax: number | null;
      workerCount: number | null;
    };
  } | null> {
    const runs: Array<{ run_id: string }> = await this.workersRepo.manager.query(
      `
      select sr.id::text as run_id
      from maywin_db.schedule_runs sr
      inner join maywin_db.schedules s on s.id = sr.schedule_id
      where s.unit_id = $1::bigint
      order by sr.id desc
      limit 20
      `,
      [String(unitId)],
    );

    if (!runs?.length) {
      this.logger.warn(`[KPI] unit=${unitId} latest_schedule_run none found`);
      return null;
    }

    this.logger.log(`[KPI] unit=${unitId} latest_schedule_run candidates=${runs.length}`);

    let assignments: Array<{ worker_id: string; shift_code: string }> = [];
    let pickedRunId: string | null = null;

    for (const r of runs) {
      const runId = String(r.run_id);
      const params: any[] = [runId];
      let idx = 2;
      const dateClauses: string[] = [];

      if (startDate) {
        dateClauses.push(`date >= $${idx}::date`);
        params.push(startDate);
        idx += 1;
      }
      if (endDate) {
        dateClauses.push(`date <= $${idx}::date`);
        params.push(endDate);
      }

      const dateSql = dateClauses.length > 0 ? `and ${dateClauses.join(' and ')}` : '';
      const rows: Array<{ worker_id: string; shift_code: string }> =
        await this.workersRepo.manager.query(
          `
          select worker_id::text as worker_id,
                 shift_code::text as shift_code
          from maywin_db.schedule_assignments
          where schedule_run_id = $1::bigint
          ${dateSql}
          `,
          params,
        );

      if (rows.length > 0) {
        assignments = rows;
        pickedRunId = runId;
        break;
      }
    }

    if (!assignments.length) {
      this.logger.warn(`[KPI] unit=${unitId} latest_schedule_run has no assignments in recent runs`);
      return null;
    }

    this.logger.log(`[KPI] unit=${unitId} latest_schedule_run picked=${pickedRunId} assignments=${assignments.length}`);

    const prefs: Array<{
      worker_id: string;
      prefers_day_shifts: boolean | null;
      prefers_night_shifts: boolean | null;
    }> = await this.workersRepo.manager.query(
      `
      select worker_id::text as worker_id,
             prefers_day_shifts::bool as prefers_day_shifts,
             prefers_night_shifts::bool as prefers_night_shifts
      from maywin_db.worker_preferences
      `,
    );

    const prefMap = new Map<string, { day: boolean; night: boolean }>();
    for (const p of prefs) {
      prefMap.set(String(p.worker_id), {
        day: !!p.prefers_day_shifts,
        night: !!p.prefers_night_shifts,
      });
    }

    const isNight = (shiftCode: string) => {
      const sc = String(shiftCode).trim().toUpperCase();
      return sc === 'N' || sc.includes('NIGHT');
    };

    const byWorker = new Map<string, { total: number; satisfied: number }>();
    const loadByWorker = new Map<string, number>();
    for (const a of assignments) {
      const workerId = String(a.worker_id);
      const state = byWorker.get(workerId) ?? { total: 0, satisfied: 0 };
      state.total += 1;
      loadByWorker.set(workerId, (loadByWorker.get(workerId) ?? 0) + 1);

      const pref = prefMap.get(workerId);
      if (!pref || (!pref.day && !pref.night)) {
        state.satisfied += 1;
      } else {
        const night = isNight(String(a.shift_code));
        const satisfied = (night && pref.night) || (!night && pref.day);
        if (satisfied) state.satisfied += 1;
      }

      byWorker.set(workerId, state);
    }

    const scores = Array.from(byWorker.values()).map((x) =>
      x.total > 0 ? x.satisfied / x.total : 0,
    );

    if (!scores.length) return null;
    const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const loads = Array.from(loadByWorker.values());
    const workerCount = loads.length;
    const workloadMin = workerCount ? Math.min(...loads) : null;
    const workloadMax = workerCount ? Math.max(...loads) : null;
    const workloadStdDev = this.stddev(loads);

    return {
      averageSatisfaction: Number(avg.toFixed(4)),
      fairness: {
        workloadStdDev,
        workloadMin,
        workloadMax,
        workerCount: workerCount || null,
      },
    };
  }

  private extractAverageSatisfaction(data: any): number | null {
    const fromByWorker = this.averageFromByWorker(data?.metrics?.satisfaction?.byWorker);
    if (fromByWorker != null) return fromByWorker;

    const raw =
      data?.metrics?.averageSatisfaction ??
      data?.metrics?.average_satisfaction ??
      data?.metrics?.satisfaction?.average ??
      data?.details?.average_satisfaction ??
      data?.details?.averageSatisfaction ??
      data?.output?.details?.average_satisfaction ??
      data?.output?.details?.averageSatisfaction ??
      data?.output?.meta?.solverDetails?.average_satisfaction ??
      data?.output?.meta?.solverDetails?.averageSatisfaction ??
      data?.averageSatisfaction ??
      data?.average_satisfaction ??
      data?.kpis?.averageSatisfaction ??
      null;

    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  private averageFromByWorker(rows: any): number | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const vals = rows
      .map((r) => Number(r?.satisfaction))
      .filter((v) => Number.isFinite(v));

    if (vals.length === 0) return null;

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Number(avg.toFixed(2));
  }

  private isS3AccessDenied(err: any): boolean {
    const msg = `${err?.name ?? ''} ${err?.message ?? ''}`.toLowerCase();
    return msg.includes('accessdenied') || msg.includes('not authorized');
  }

  private stddev(values: number[]): number | null {
    if (!values.length) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
      values.length;
    return Number(Math.sqrt(variance).toFixed(6));
  }
}
