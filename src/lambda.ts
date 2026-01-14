// src/lambda.ts
import 'reflect-metadata';
import { Context } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppModule } from './app.module';

import { JobsService } from '@/core/jobs/jobs.service';
import { NormalizerService } from '@/core/normalizer/normalizer.service';
import { SolverAdapter } from '@/core/solver/solver.adapter';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';

import {
  ScheduleJob,
  ScheduleJobStatus,
} from '@/database/entities/orchestration/schedule-job.entity';
import {
  ScheduleArtifact,
  ScheduleArtifactType,
} from '@/database/entities/orchestration/schedule-artifact.entity';

type AnyObj = Record<string, any>;

enum Op {
  CREATE_JOB = 'CREATE_JOB',
  NORMALIZE = 'NORMALIZE',
  SOLVE_PLAN_A_STRICT = 'SOLVE_PLAN_A_STRICT',
  PERSIST_SCHEDULE = 'PERSIST_SCHEDULE',
  EVALUATE_SCHEDULE = 'EVALUATE_SCHEDULE',
  MARK_SUCCESS = 'MARK_SUCCESS',
  MARK_FAILED = 'MARK_FAILED',
}

let cachedApp: any | null = null;

async function getApp() {
  if (cachedApp) return cachedApp;
  cachedApp = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  return cachedApp;
}

function pickJobId(input: AnyObj): string | null {
  return (input?.jobId ??
    input?.job_id ??
    input?.job?.id ??
    input?.job?.jobId ??
    null) as string | null;
}

function extractCreateJobInput(event: any): {
  scheduleId: string;
  idempotencyKey: string | null;
  dto: {
    startDate: string;
    endDate: string;
    strategy?: AnyObj;
    solverConfig?: AnyObj;
    options?: AnyObj;
    notes?: string;
  };
} {
  const maybe = event?.input ?? event;
  if (!maybe || typeof maybe !== 'object')
    throw new Error('Invalid event: expected object input');

  const scheduleId = maybe.scheduleId ?? maybe.schedule_id;
  const dto =
    maybe.dto ??
    ({
      startDate: maybe.startDate ?? maybe.start_date,
      endDate: maybe.endDate ?? maybe.end_date,
      strategy: maybe.strategy,
      solverConfig: maybe.solverConfig,
      options: maybe.options,
      notes: maybe.notes,
    } as any);

  const idempotencyKey = (maybe.idempotencyKey ??
    maybe.idempotency_key ??
    null) as string | null;

  if (!scheduleId || typeof scheduleId !== 'string')
    throw new Error('Missing required field: scheduleId');
  if (!dto?.startDate || !dto?.endDate)
    throw new Error('Missing required dto fields: startDate/endDate');

  return { scheduleId, idempotencyKey, dto };
}

async function getLatestJobIdForSchedule(
  jobsRepo: Repository<ScheduleJob>,
  scheduleId: string,
): Promise<string | null> {
  const rows = await jobsRepo.find({
    order: { created_at: 'DESC' as any } as any,
    take: 50,
  });
  const found = rows.find(
    (r) =>
      String((r.attributes as any)?.scheduleId ?? '') === String(scheduleId),
  );
  return found?.id ? String(found.id) : null;
}

async function setJobStatusSafe(args: {
  jobsRepo: Repository<ScheduleJob>;
  jobId: string;
  next: ScheduleJobStatus;
}) {
  const { jobsRepo, jobId, next } = args;
  await jobsRepo.update({ id: jobId } as any, { status: next as any } as any);
}

async function markJobFailed(args: {
  jobsRepo: Repository<ScheduleJob>;
  jobId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const { jobsRepo, jobId, errorCode, errorMessage } = args;
  await jobsRepo.update(
    { id: jobId } as any,
    {
      status: ScheduleJobStatus.FAILED as any,
      error_code: (errorCode ?? null) as any,
      error_message: (errorMessage ?? null) as any,
    } as any,
  );
}

async function upsertArtifactS3(args: {
  artifactsRepo: Repository<ScheduleArtifact>;
  jobId: string;
  type: ScheduleArtifactType;
  bucket: string;
  key: string;
  contentType: string;
  sha256?: string | null;
  bytes?: number | null;
  metadata?: AnyObj;
}): Promise<ScheduleArtifact> {
  const {
    artifactsRepo,
    jobId,
    type,
    bucket,
    key,
    contentType,
    sha256,
    bytes,
    metadata,
  } = args;

  const existing = await artifactsRepo.findOne({
    where: { job_id: jobId as any, type: type as any } as any,
  });

  const patch: Partial<ScheduleArtifact> = {
    storage_provider: 's3',
    bucket,
    object_key: key,
    content_type: contentType,
    content_sha256: (sha256 ?? null) as any,
    content_bytes: (bytes == null ? null : String(bytes)) as any,
    metadata: (metadata ?? {}) as any,
  };

  if (existing) {
    await artifactsRepo.update({ id: existing.id } as any, patch as any);
    const reloaded = await artifactsRepo.findOne({
      where: { id: existing.id } as any,
    });
    return (reloaded ?? existing) as ScheduleArtifact;
  }

  const created = artifactsRepo.create({
    job_id: jobId as any,
    type: type as any,
    ...(patch as any),
  } satisfies Partial<ScheduleArtifact>);

  const saved = await artifactsRepo.save(created as any);
  return (Array.isArray(saved) ? saved[0] : saved) as ScheduleArtifact;
}

async function resolveNormalizedPointer(args: {
  artifactsRepo: Repository<ScheduleArtifact>;
  jobId: string;
  input: AnyObj;
}): Promise<{ bucket: string; key: string } | null> {
  const { artifactsRepo, jobId, input } = args;

  const b = input?.normalizedArtifact?.bucket;
  const k = input?.normalizedArtifact?.key;
  if (b && k) return { bucket: String(b), key: String(k) };

  const row = await artifactsRepo.findOne({
    where: {
      job_id: jobId as any,
      type: ScheduleArtifactType.NORMALIZED_INPUT as any,
    } as any,
  });
  if (!row?.bucket || !row?.object_key) return null;
  return { bucket: String(row.bucket), key: String(row.object_key) };
}

async function resolveSolverPointer(args: {
  artifactsRepo: Repository<ScheduleArtifact>;
  jobId: string;
  input: AnyObj;
}): Promise<{ bucket: string; key: string } | null> {
  const { artifactsRepo, jobId, input } = args;

  const b = input?.solverArtifact?.bucket;
  const k = input?.solverArtifact?.key;
  if (b && k) return { bucket: String(b), key: String(k) };

  const row = await artifactsRepo.findOne({
    where: {
      job_id: jobId as any,
      type: ScheduleArtifactType.SOLVER_OUTPUT as any,
    } as any,
  });
  if (!row?.bucket || !row?.object_key) return null;
  return { bucket: String(row.bucket), key: String(row.object_key) };
}

function extractSolverResultLayer(solverFile: any) {
  const layer = solverFile?.result ?? solverFile;
  const assignments = layer?.assignments ?? [];
  return { layer, assignments };
}

function normalizeAssignment(
  a: any,
): { nurseCode: string; date: string; shiftCode: string } | null {
  const nurseCode =
    a?.nurseCode ?? a?.workerCode ?? a?.nurse ?? a?.worker ?? null;
  const date = a?.date ?? a?.day ?? null;
  const shiftCode = a?.shiftCode ?? a?.shift ?? null;
  if (!nurseCode || !date || !shiftCode) return null;
  return {
    nurseCode: String(nurseCode),
    date: String(date),
    shiftCode: String(shiftCode),
  };
}

/** KPI helpers */
function mean(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function stddev(nums: number[]) {
  if (nums.length <= 1) return 0;
  const m = mean(nums);
  const v = nums.reduce((acc, x) => acc + (x - m) * (x - m), 0) / nums.length;
  return Math.sqrt(v);
}

export const handler = async (event: AnyObj, _context: Context) => {
  const logger = new Logger('LambdaOpRouter');

  const op: Op | undefined = event?.op as Op | undefined;
  const input: AnyObj = (event?.input ?? event) as AnyObj;

  if (!op)
    return {
      status: 'FAILED',
      name: 'Error',
      message: 'Missing op. Expected { op, input }',
    };

  const app = await getApp();

  const jobsRepo = app.get(
    getRepositoryToken(ScheduleJob),
  ) as Repository<ScheduleJob>;
  const artifactsRepo = app.get(
    getRepositoryToken(ScheduleArtifact),
  ) as Repository<ScheduleArtifact>;

  const jobsService = app.get(JobsService) as JobsService;
  const normalizer = app.get(NormalizerService) as NormalizerService;
  const solver = app.get(SolverAdapter) as SolverAdapter;
  const s3Artifacts = app.get(S3ArtifactsService) as S3ArtifactsService;

  try {
    switch (op) {
      case Op.CREATE_JOB: {
        const { scheduleId, idempotencyKey, dto } =
          extractCreateJobInput(event);

        const enqueueLocalRunner =
          String(process.env.ENQUEUE_LOCAL_RUNNER ?? 'false').toLowerCase() ===
          'true';

        const res = await jobsService.createJob(
          scheduleId,
          dto as any,
          idempotencyKey ?? null,
          { enqueueLocalRunner },
        );

        const job = res?.job ?? res;

        return {
          status: 'COMPLETED',
          op_done: 'CREATE_JOB',
          scheduleId: job?.scheduleId ?? scheduleId,
          startDate: dto.startDate,
          endDate: dto.endDate,
          idempotencyKey: idempotencyKey ?? null,
          job,
          jobId: job?.id ?? null,
        };
      }

      case Op.NORMALIZE: {
        let jobId = pickJobId(input);
        if (!jobId && input?.scheduleId)
          jobId = await getLatestJobIdForSchedule(
            jobsRepo,
            String(input.scheduleId),
          );
        if (!jobId)
          return {
            status: 'FAILED',
            name: 'Error',
            message: 'NORMALIZE requires jobId (or scheduleId fallback)',
          };

        const job = await jobsRepo.findOne({ where: { id: jobId } as any });
        if (!job)
          return {
            status: 'FAILED',
            name: 'Error',
            message: `ScheduleJob not found: ${jobId}`,
          };

        await setJobStatusSafe({
          jobsRepo,
          jobId: String(jobId),
          next: ScheduleJobStatus.NORMALIZING,
        });

        const { payload, meta } = await normalizer.build(String(jobId));

        const s3Obj = {
          schema: 'NormalizedInput.v1',
          jobId: String(jobId),
          scheduleId:
            input?.scheduleId ?? (job.attributes as any)?.scheduleId ?? null,
          startDate: String(job.start_date),
          endDate: String(job.end_date),
          createdAt: new Date().toISOString(),
          payload,
          meta,
        };

        const keyParts = ['jobs', String(jobId), 'normalized', 'v1.json'];
        const ref = await s3Artifacts.putJson(keyParts, s3Obj);
        const bytes = Buffer.byteLength(JSON.stringify(s3Obj), 'utf8');

        await upsertArtifactS3({
          artifactsRepo,
          jobId: String(jobId),
          type: ScheduleArtifactType.NORMALIZED_INPUT,
          bucket: ref.bucket,
          key: ref.key,
          contentType: 'application/json',
          sha256: null,
          bytes,
          metadata: { schema: 'NormalizedInput.v1' },
        });

        return {
          status: 'COMPLETED',
          op_done: 'NORMALIZE',
          jobId: String(jobId),
          scheduleId: s3Obj.scheduleId,
          startDate: s3Obj.startDate,
          endDate: s3Obj.endDate,
          normalizedArtifact: {
            bucket: ref.bucket,
            key: ref.key,
            bytes,
          },
        };
      }

      case Op.SOLVE_PLAN_A_STRICT: {
        let jobId = pickJobId(input);
        if (!jobId && input?.scheduleId)
          jobId = await getLatestJobIdForSchedule(
            jobsRepo,
            String(input.scheduleId),
          );
        if (!jobId)
          return {
            status: 'FAILED',
            name: 'Error',
            message:
              'SOLVE_PLAN_A_STRICT requires jobId (or scheduleId fallback)',
          };

        const job = await jobsRepo.findOne({ where: { id: jobId } as any });
        if (!job)
          return {
            status: 'FAILED',
            name: 'Error',
            message: `ScheduleJob not found: ${jobId}`,
          };

        await setJobStatusSafe({
          jobsRepo,
          jobId: String(jobId),
          next: ScheduleJobStatus.SOLVING_A_STRICT,
        });

        const normPtr = await resolveNormalizedPointer({
          artifactsRepo,
          jobId: String(jobId),
          input,
        });
        if (!normPtr) {
          await markJobFailed({
            jobsRepo,
            jobId: String(jobId),
            errorMessage: 'Missing normalized artifact pointer',
          });
          return {
            status: 'FAILED',
            name: 'Error',
            message: 'Missing normalized artifact pointer',
          };
        }

        const normalizedObj = await s3Artifacts.getJson(normPtr);
        const normalizedPayload = normalizedObj?.payload ?? normalizedObj;

        const started = Date.now();
        let result: any;
        try {
          result = await solver.solve(normalizedPayload, {
            plan: 'A_STRICT',
            jobId: String(jobId),
            timeLimitSeconds:
              Number(input?.solverConfig?.timeLimitSeconds ?? 30) || 30,
          } as any);
        } catch (e: any) {
          result = {
            feasible: false,
            status: 'ERROR',
            assignments: [],
            details: e?.message ?? String(e),
            meta: { plan: 'A_STRICT', jobId: String(jobId), error: true },
          };
        }
        const elapsedMs = Date.now() - started;

        const outObj = {
          schema: 'SolverResult.v1',
          jobId: String(jobId),
          plan: 'A_STRICT',
          createdAt: new Date().toISOString(),
          elapsedMs,
          result,
        };

        const keyParts = [
          'jobs',
          String(jobId),
          'solve-plan-a-strict.result.json',
        ];
        const ref = await s3Artifacts.putJson(keyParts, outObj);
        const bytes = Buffer.byteLength(JSON.stringify(outObj), 'utf8');

        await upsertArtifactS3({
          artifactsRepo,
          jobId: String(jobId),
          type: ScheduleArtifactType.SOLVER_OUTPUT,
          bucket: ref.bucket,
          key: ref.key,
          contentType: 'application/json',
          sha256: null,
          bytes,
          metadata: { schema: 'SolverResult.v1', plan: 'A_STRICT', elapsedMs },
        });

        return {
          status: 'COMPLETED',
          op_done: 'SOLVE_PLAN_A_STRICT',
          jobId: String(jobId),
          scheduleId:
            input?.scheduleId ?? (job.attributes as any)?.scheduleId ?? null,
          solverArtifact: {
            type: 'SOLVER_OUTPUT',
            bucket: ref.bucket,
            key: ref.key,
            bytes,
            elapsedMs,
          },
          solver: {
            feasible: !!result?.feasible,
            objective: result?.objective ?? null,
          },
        };
      }

      case Op.PERSIST_SCHEDULE: {
        let jobId = pickJobId(input);
        if (!jobId && input?.scheduleId)
          jobId = await getLatestJobIdForSchedule(
            jobsRepo,
            String(input.scheduleId),
          );
        if (!jobId)
          return {
            status: 'FAILED',
            name: 'Error',
            message: 'PERSIST_SCHEDULE requires jobId (or scheduleId fallback)',
          };

        const job = await jobsRepo.findOne({ where: { id: jobId } as any });
        if (!job)
          return {
            status: 'FAILED',
            name: 'Error',
            message: `ScheduleJob not found: ${jobId}`,
          };

        const scheduleId = String(
          input?.scheduleId ?? (job.attributes as any)?.scheduleId ?? '',
        );
        if (!scheduleId)
          return {
            status: 'FAILED',
            name: 'Error',
            message: 'PERSIST_SCHEDULE requires scheduleId',
          };

        await setJobStatusSafe({
          jobsRepo,
          jobId: String(jobId),
          next: ScheduleJobStatus.PERSISTING,
        });

        const solverPtr = await resolveSolverPointer({
          artifactsRepo,
          jobId: String(jobId),
          input,
        });
        if (!solverPtr) {
          await markJobFailed({
            jobsRepo,
            jobId: String(jobId),
            errorMessage: 'Missing solver artifact pointer',
          });
          return {
            status: 'FAILED',
            name: 'Error',
            message: 'Missing solver artifact pointer',
          };
        }

        const solverFile = await s3Artifacts.getJson(solverPtr);
        const { layer, assignments } = extractSolverResultLayer(solverFile);

        const feasibleFlag = layer?.feasible;
        const feasible =
          typeof feasibleFlag === 'boolean'
            ? feasibleFlag
            : Array.isArray(assignments) && assignments.length > 0;

        if (!feasible) {
          const details =
            layer?.details ??
            layer?.meta?.details ??
            'Solver infeasible / error';
          await markJobFailed({
            jobsRepo,
            jobId: String(jobId),
            errorMessage: String(details),
          });
          return { status: 'FAILED', name: 'Error', message: String(details) };
        }

        const cleaned = (assignments as any[])
          .map(normalizeAssignment)
          .filter(
            (x): x is { nurseCode: string; date: string; shiftCode: string } =>
              !!x,
          );

        if (cleaned.length === 0) {
          await markJobFailed({
            jobsRepo,
            jobId: String(jobId),
            errorMessage: 'Solver feasible but produced no assignments',
          });
          return {
            status: 'FAILED',
            name: 'Error',
            message: 'Solver feasible but produced no assignments',
          };
        }

        const uniqueCodes = Array.from(
          new Set(cleaned.map((x) => x.nurseCode)),
        );

        const workerRows: Array<{ id: string; worker_code: string }> =
          await jobsRepo.manager.query(
            `
          select id::text as id, worker_code::text as worker_code
          from maywin_db.workers
          where worker_code = any($1::text[])
          `,
            [uniqueCodes],
          );

        const codeToWorkerId = new Map<string, string>();
        for (const r of workerRows)
          codeToWorkerId.set(String(r.worker_code), String(r.id));

        const missing = uniqueCodes.filter((c) => !codeToWorkerId.has(c));
        if (missing.length > 0) {
          await markJobFailed({
            jobsRepo,
            jobId: String(jobId),
            errorMessage: `Missing workers in DB for worker_code: ${missing.join(
              ', ',
            )}`,
          });
          return {
            status: 'FAILED',
            name: 'Error',
            message: `Missing workers in DB for worker_code: ${missing.join(
              ', ',
            )}`,
          };
        }

        const rowsToUpsert = cleaned.map((x) => ({
          schedule_id: scheduleId,
          worker_id: codeToWorkerId.get(x.nurseCode)!,
          date: x.date,
          shift_code: x.shiftCode,
        }));

        await jobsRepo.manager.transaction(async (trx) => {
          await trx.query(
            `
            insert into maywin_db.schedule_assignments
              (schedule_id, worker_id, date, shift_code, source, attributes)
            select
              x.schedule_id::bigint,
              x.worker_id::bigint,
              x.date::date,
              x.shift_code::text,
              'SOLVER',
              '{}'::jsonb
            from jsonb_to_recordset($1::jsonb)
              as x(schedule_id text, worker_id text, date text, shift_code text)
            on conflict on constraint sa_uniq
            do update set
              shift_code = excluded.shift_code,
              source = 'SOLVER',
              updated_at = now()
            `,
            [JSON.stringify(rowsToUpsert)],
          );

          try {
            const solverRunRows: Array<{ id: string }> = await trx.query(
              `
              select id::text as id
              from maywin_db.solver_runs
              where job_id = $1::uuid
              order by id desc
              limit 1
              `,
              [String(jobId)],
            );

            const solver_run_id = solverRunRows?.[0]?.id;

            if (solver_run_id) {
              const rowsForRun = rowsToUpsert.map((r) => ({
                solver_run_id,
                worker_id: r.worker_id,
                date: r.date,
                shift_code: r.shift_code,
              }));

              await trx.query(
                `
                insert into maywin_db.solver_run_assignments
                  (solver_run_id, worker_id, date, shift_code, attributes)
                select
                  x.solver_run_id::bigint,
                  x.worker_id::bigint,
                  x.date::date,
                  x.shift_code::text,
                  '{}'::jsonb
                from jsonb_to_recordset($1::jsonb)
                  as x(solver_run_id text, worker_id text, date text, shift_code text)
                on conflict on constraint sra_uniq
                do update set
                  shift_code = excluded.shift_code,
                  attributes = excluded.attributes
                `,
                [JSON.stringify(rowsForRun)],
              );
            }
          } catch {}

          await trx.query(
            `
            update maywin_db.schedule_jobs
            set
              status = 'COMPLETED',
              final_schedule_id = $2::bigint,
              updated_at = now()
            where id = $1::uuid
            `,
            [String(jobId), String(scheduleId)],
          );
        });

        return {
          status: 'COMPLETED',
          op_done: 'PERSIST_SCHEDULE',
          jobId: String(jobId),
          scheduleId,
          persistedAssignments: rowsToUpsert.length,
        };
      }

      case Op.EVALUATE_SCHEDULE: {
        let jobId = pickJobId(input);
        if (!jobId && input?.scheduleId)
          jobId = await getLatestJobIdForSchedule(
            jobsRepo,
            String(input.scheduleId),
          );
        if (!jobId)
          return {
            status: 'FAILED',
            name: 'Error',
            message:
              'EVALUATE_SCHEDULE requires jobId (or scheduleId fallback)',
          };

        const job = await jobsRepo.findOne({ where: { id: jobId } as any });
        if (!job)
          return {
            status: 'FAILED',
            name: 'Error',
            message: `ScheduleJob not found: ${jobId}`,
          };

        const scheduleId = String(
          input?.scheduleId ??
            job.final_schedule_id ??
            (job.attributes as any)?.scheduleId ??
            '',
        );
        if (!scheduleId)
          return {
            status: 'FAILED',
            name: 'Error',
            message:
              'EVALUATE_SCHEDULE requires scheduleId (or job.final_schedule_id)',
          };

        const started = Date.now();

        // 1) Pull persisted assignments
        const assignments: Array<{
          worker_id: string;
          date: string;
          shift_code: string;
        }> = await jobsRepo.manager.query(
          `
          select worker_id::text as worker_id, date::text as date, shift_code::text as shift_code
          from maywin_db.schedule_assignments
          where schedule_id = $1::bigint
          `,
          [String(scheduleId)],
        );

        const totalAssigned = assignments.length;

        // 2) Coverage rules (required)
        const unitId = String(
          job.unit_id ?? (job.attributes as any)?.unitId ?? '',
        );

        let coverageRules: Array<{
          shift_code: string;
          day_type: string;
          min_workers: number | null;
        }> = [];
        try {
          coverageRules = await jobsRepo.manager.query(
            `
            select shift_code::text as shift_code, day_type::text as day_type, min_workers::int as min_workers
            from maywin_db.coverage_rules
            where unit_id = $1::bigint
            `,
            [unitId],
          );
        } catch {
          coverageRules = [];
        }

        const startDate = String(job.start_date);
        const endDate = String(job.end_date);

        function toDate(s: string) {
          const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
          return new Date(Date.UTC(y, m - 1, d));
        }
        function fmtDate(dt: Date) {
          const y = dt.getUTCFullYear();
          const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
          const d = String(dt.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }

        const start = toDate(startDate);
        const end = toDate(endDate);
        const days: string[] = [];
        for (
          let t = start.getTime();
          t <= end.getTime();
          t += 24 * 3600 * 1000
        ) {
          days.push(fmtDate(new Date(t)));
        }

        const requiredPerDay = coverageRules.reduce(
          (acc, r) => acc + (r.min_workers ?? 0),
          0,
        );
        const totalRequired = requiredPerDay * days.length;

        const coverageRatio =
          totalRequired > 0 ? totalAssigned / totalRequired : null;

        // 3) Preference satisfaction (simple day/night)
        let prefs: Array<{
          worker_id: string;
          prefers_day_shifts: boolean | null;
          prefers_night_shifts: boolean | null;
        }> = [];
        try {
          prefs = await jobsRepo.manager.query(
            `
            select worker_id::text as worker_id,
                   prefers_day_shifts::bool as prefers_day_shifts,
                   prefers_night_shifts::bool as prefers_night_shifts
            from maywin_db.worker_preferences
            `,
          );
        } catch {
          prefs = [];
        }

        const prefMap = new Map<string, { day: boolean; night: boolean }>();
        for (const p of prefs) {
          prefMap.set(String(p.worker_id), {
            day: !!p.prefers_day_shifts,
            night: !!p.prefers_night_shifts,
          });
        }

        const isNight = (shiftCode: string) =>
          String(shiftCode).toUpperCase().includes('NIGHT');

        const byWorker = new Map<
          string,
          { total: number; satisfied: number }
        >();
        for (const a of assignments) {
          const wid = String(a.worker_id);
          const st = byWorker.get(wid) ?? { total: 0, satisfied: 0 };
          st.total += 1;

          const pref = prefMap.get(wid);
          if (!pref || (!pref.day && !pref.night)) {
            st.satisfied += 1;
          } else {
            const night = isNight(a.shift_code);
            const sat = (night && pref.night) || (!night && pref.day);
            if (sat) st.satisfied += 1;
          }

          byWorker.set(wid, st);
        }

        const workerScores: Array<{ worker_id: string; satisfaction: number }> =
          [];
        for (const [wid, st] of byWorker.entries()) {
          const score = st.total > 0 ? st.satisfied / st.total : 0;
          workerScores.push({ worker_id: wid, satisfaction: score });
        }
        const avgSatisfaction = workerScores.length
          ? mean(workerScores.map((x) => x.satisfaction))
          : null;

        // 4) Availability violations (assigned on UNAVAILABLE)
        let unavailable: Array<{
          worker_id: string;
          date: string;
          shift_code: string;
        }> = [];
        try {
          unavailable = await jobsRepo.manager.query(
            `
            select worker_id::text as worker_id, date::text as date, shift_code::text as shift_code
            from maywin_db.worker_availability
            where unit_id = $1::bigint
              and type::text = 'UNAVAILABLE'
            `,
            [unitId],
          );
        } catch {
          unavailable = [];
        }

        const unavailKey = new Set(
          unavailable.map((u) => `${u.worker_id}__${u.date}__${u.shift_code}`),
        );
        let availabilityViolations = 0;
        for (const a of assignments) {
          const k = `${a.worker_id}__${a.date}__${a.shift_code}`;
          if (unavailKey.has(k)) availabilityViolations += 1;
        }

        // 5) Workload fairness: distribution of total assignments per worker
        const counts = new Map<string, number>();
        for (const a of assignments)
          counts.set(a.worker_id, (counts.get(a.worker_id) ?? 0) + 1);

        const loads = Array.from(counts.values());
        const fairnessStdDev = loads.length ? stddev(loads) : null;
        const fairnessMin = loads.length ? Math.min(...loads) : null;
        const fairnessMax = loads.length ? Math.max(...loads) : null;

        const elapsedMs = Date.now() - started;

        const kpi = {
          schema: 'KpiSummary.v1',
          jobId: String(jobId),
          scheduleId: String(scheduleId),
          unitId: unitId || null,
          window: { startDate, endDate },
          computedAt: new Date().toISOString(),
          metrics: {
            coverage: {
              totalAssigned,
              totalRequired,
              requiredPerDay,
              days: days.length,
              ratio: coverageRatio,
            },
            satisfaction: {
              average: avgSatisfaction,
              byWorker: workerScores.slice(0, 200),
            },
            violations: {
              availability: availabilityViolations,
            },
            fairness: {
              workloadStdDev: fairnessStdDev,
              workloadMin: fairnessMin,
              workloadMax: fairnessMax,
              workerCount: counts.size,
            },
          },
          meta: {
            notes: [
              'coverage.totalRequired is computed as sum(coverage_rules.min_workers) * number_of_days (baseline)',
              'satisfaction uses simple DAY vs NIGHT preference heuristic based on shift_code containing "NIGHT"',
            ],
            elapsedMs,
          },
        };

        // Store as S3 artifact
        const keyParts = ['jobs', String(jobId), 'kpis', 'kpi-summary.v1.json'];
        const ref = await s3Artifacts.putJson(keyParts, kpi);
        const bytes = Buffer.byteLength(JSON.stringify(kpi), 'utf8');

        const artifactRow = await upsertArtifactS3({
          artifactsRepo,
          jobId: String(jobId),
          type: ScheduleArtifactType.KPI_SUMMARY,
          bucket: ref.bucket,
          key: ref.key,
          contentType: 'application/json',
          sha256: null,
          bytes,
          metadata: { schema: 'KpiSummary.v1', elapsedMs },
        });

        try {
          await jobsRepo.manager.query(
            `
            update maywin_db.solver_runs
            set
              kpis_json = $2::jsonb,
              evaluation_artifact_id = $3::uuid
            where id = (
              select id
              from maywin_db.solver_runs
              where job_id = $1::uuid
              order by id desc
              limit 1
            )
            `,
            [
              String(jobId),
              JSON.stringify(kpi.metrics),
              String(artifactRow.id),
            ],
          );
        } catch {}

        return {
          status: 'COMPLETED',
          op_done: 'EVALUATE_SCHEDULE',
          jobId: String(jobId),
          scheduleId: String(scheduleId),
          kpiArtifact: {
            type: 'KPI_SUMMARY',
            bucket: ref.bucket,
            key: ref.key,
            bytes,
            elapsedMs,
          },
          kpis: {
            coverageRatio,
            averageSatisfaction: avgSatisfaction,
            availabilityViolations,
            workloadStdDev: fairnessStdDev,
          },
        };
      }

      case Op.MARK_SUCCESS: {
        const jobId = pickJobId(input);
        if (jobId)
          await setJobStatusSafe({
            jobsRepo,
            jobId: String(jobId),
            next: ScheduleJobStatus.COMPLETED,
          });
        return { status: 'COMPLETED', op_done: 'MARK_SUCCESS' };
      }

      case Op.MARK_FAILED: {
        const jobId = pickJobId(input);
        const err = input?.error ?? null;
        const cause = input?.cause ?? null;

        if (jobId) {
          await markJobFailed({
            jobsRepo,
            jobId: String(jobId),
            errorCode: err ? String(err) : null,
            errorMessage: cause ? String(cause) : null,
          });
        }

        return { status: 'FAILED', op_done: 'MARK_FAILED', error: err, cause };
      }

      default:
        return {
          status: 'FAILED',
          name: 'Error',
          message: `Unknown op: ${String(op)}`,
        };
    }
  } catch (e: any) {
    logger.error(e?.stack ?? e);
    return {
      status: 'FAILED',
      name: e?.name ?? 'Error',
      message: e?.message ?? String(e),
    };
  }
};
