// src/core/jobs/jobs-runner.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import {
  ScheduleJob,
  ScheduleJobStatus,
} from '@/database/entities/orchestration/schedule-job.entity';
import { SolverPlan } from '@/database/enums/solver-plan.enum';
import {
  ScheduleArtifact,
  ScheduleArtifactType,
} from '@/database/entities/orchestration/schedule-artifact.entity';

import {
  NormalizerService,
  NormalizedInputV1,
} from '@/core/normalizer/normalizer.service';
import { SolverAdapter } from '@/core/solver/solver.adapter';

type SolverRawOutput = Record<string, any>;

@Injectable()
export class JobsRunnerService {
  private readonly logger = new Logger(JobsRunnerService.name);

  // Phase 2A local runner queue (in-memory)
  private running = false;
  private queue: string[] = [];

  constructor(
    @InjectRepository(ScheduleJob)
    private readonly jobsRepo: Repository<ScheduleJob>,

    @InjectRepository(ScheduleArtifact)
    private readonly artifactsRepo: Repository<ScheduleArtifact>,

    private readonly normalizer: NormalizerService,
    private readonly solver: SolverAdapter,
  ) {}

  enqueue(jobId: string) {
    this.queue.push(jobId);
    this.kick();
  }

  private kick() {
    if (this.running) return;
    this.running = true;

    setImmediate(async () => {
      try {
        while (this.queue.length > 0) {
          const jobId = this.queue.shift()!;
          await this.run(jobId);
        }
      } finally {
        this.running = false;
      }
    });
  }

  async run(jobId: string) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    // Idempotent guard: only run if still REQUESTED
    if (job.status !== ScheduleJobStatus.REQUESTED) return;

    try {
      // 1) VALIDATED
      await this.transition(
        jobId,
        ScheduleJobStatus.REQUESTED,
        ScheduleJobStatus.VALIDATED,
      );

      // 2) NORMALIZING
      await this.transition(
        jobId,
        ScheduleJobStatus.VALIDATED,
        ScheduleJobStatus.NORMALIZING,
      );

      const { payload, meta } = await this.normalizer.build(jobId);

      await this.writeArtifactJsonOnce(
        jobId,
        ScheduleArtifactType.NORMALIZED_INPUT,
        {
          schema: 'NormalizedInput.v1',
          payload,
          meta,
        },
      );

      // Save meta for downstream preview/apply convenience
      await this.mergeJobAttributes(jobId, { normalizerMeta: meta });

      // 3) SOLVING with fallback plans
      const {
        output: solverOutput,
        chosenPlan,
        finalStatus,
      } = await this.solveWithFallback(jobId, payload);

      // persist chosen plan on job
      await this.jobsRepo.update({ id: jobId }, {
        chosen_plan: chosenPlan as any,
      } as any);

      await this.writeArtifactJsonOnce(
        jobId,
        ScheduleArtifactType.SOLVER_OUTPUT,
        {
          schema: 'SolverOutput.v1',
          chosenPlan,
          output: solverOutput,
        },
      );

      await this.writeArtifactJsonOnce(
        jobId,
        ScheduleArtifactType.KPI_SUMMARY,
        this.buildKpiSummary(payload, solverOutput, chosenPlan),
      );

      // 3.5) Preview
      await this.writePreviewFromSolverOutput(jobId, solverOutput, meta);

      // 4) EVALUATING
      await this.transition(jobId, finalStatus, ScheduleJobStatus.EVALUATING);

      const evaluation = this.basicEvaluate(
        payload as any,
        solverOutput,
        chosenPlan,
      );
      await this.writeArtifactJsonOnce(
        jobId,
        ScheduleArtifactType.EVALUATION_REPORT,
        evaluation,
      );

      // 5) PERSISTING (Phase 2A: do NOT auto-apply)
      await this.transition(
        jobId,
        ScheduleJobStatus.EVALUATING,
        ScheduleJobStatus.PERSISTING,
      );

      // 6) COMPLETED
      await this.transition(
        jobId,
        ScheduleJobStatus.PERSISTING,
        ScheduleJobStatus.COMPLETED,
      );
    } catch (err: any) {
      this.logger.error(`Job failed job=${jobId} msg=${err?.message ?? err}`);
      await this.fail(jobId, err);
    }
  }

  /**
   * Try A_STRICT -> (if infeasible/timeout) A_RELAXED -> (if still infeasible/timeout) B_MILP
   * Returns the solver output + chosen plan + what status we ended on before evaluating.
   */
  private async solveWithFallback(
    jobId: string,
    payload: Record<string, any>,
  ): Promise<{
    output: SolverRawOutput;
    chosenPlan: SolverPlan;
    finalStatus: ScheduleJobStatus;
  }> {
    // --- Plan A Strict ---
    await this.transition(
      jobId,
      ScheduleJobStatus.NORMALIZING,
      ScheduleJobStatus.SOLVING_A_STRICT,
    );

    const outStrict = await this.safeSolve(jobId, payload, {
      plan: 'A_STRICT',
      timeLimitSeconds: 30,
    });

    if (this.isSolveGood(outStrict)) {
      return {
        output: outStrict,
        chosenPlan: SolverPlan.A_STRICT,
        finalStatus: ScheduleJobStatus.SOLVING_A_STRICT,
      };
    }

    // --- Plan A Relaxed ---
    await this.transition(
      jobId,
      ScheduleJobStatus.SOLVING_A_STRICT,
      ScheduleJobStatus.SOLVING_A_RELAXED,
    );

    const outRelaxed = await this.safeSolve(jobId, payload, {
      plan: 'A_RELAXED',
      timeLimitSeconds: 20,
    });

    if (this.isSolveGood(outRelaxed)) {
      return {
        output: outRelaxed,
        chosenPlan: SolverPlan.A_RELAXED,
        finalStatus: ScheduleJobStatus.SOLVING_A_RELAXED,
      };
    }

    // --- Plan B MILP (optional fallback) ---
    await this.transition(
      jobId,
      ScheduleJobStatus.SOLVING_A_RELAXED,
      ScheduleJobStatus.SOLVING_B_MILP,
    );

    const outMilp = await this.safeSolve(jobId, payload, {
      plan: 'B_MILP',
      timeLimitSeconds: 25,
    });

    if (this.isSolveGood(outMilp)) {
      return {
        output: outMilp,
        chosenPlan: SolverPlan.B_MILP,
        finalStatus: ScheduleJobStatus.SOLVING_B_MILP,
      };
    }

    const reason =
      this.extractFailureReason(outMilp) ||
      this.extractFailureReason(outRelaxed) ||
      this.extractFailureReason(outStrict) ||
      'No feasible solution';

    await this.mergeJobAttributes(jobId, {
      solverFailDebug: {
        strict: outStrict,
        relaxed: outRelaxed,
        milp: outMilp,
      },
    });

    const err = new Error(`All solver plans failed: ${reason}`);
    (err as any).code = 'SOLVER_INFEASIBLE';
    throw err;
  }

  /**
   * Calls SolverAdapter and returns output even if the solver throws,
   * so we can still store debugging artifacts.
   */
  private async safeSolve(
    jobId: string,
    payload: Record<string, any>,
    opts: { plan: any; timeLimitSeconds: number },
  ) {
    try {
      return await this.solver.solve(payload, {
        jobId,
        plan: opts.plan,
        timeLimitSeconds: opts.timeLimitSeconds,
      });
    } catch (e: any) {
      return {
        feasible: false,
        status: 'ERROR',
        details: e?.message ?? String(e),
        assignments: [],
        meta: { error: true, plan: opts.plan, jobId },
      };
    }
  }

  // Build KPI summary from normalized input + solver output + chosen plan
  // Used as a ScheduleArtifact of type KPI_SUMMARY
  private buildKpiSummary(
    normalized: NormalizedInputV1,
    solverOutput: SolverRawOutput,
    chosenPlan: SolverPlan,
  ) {
    const out: any = solverOutput ?? {};
    const details: any =
      out.details ?? out.meta?.solverDetails ?? out.meta?.details ?? {};

    const assignments = out.assignments ?? out.solution?.assignments ?? [];

    const assignmentCount = Array.isArray(assignments) ? assignments.length : 0;

    const feasible =
      typeof out.feasible === 'boolean'
        ? out.feasible
        : this.isSolveGood(solverOutput);

    return {
      schema: 'KpiSummary.v1',
      generatedFrom: 'SolverOutput.v1',
      chosenPlan,
      metrics: {
        feasible,
        solverStatus: out.status ?? null,
        objective: out.objective ?? null,

        assignmentCount,

        averageSatisfaction: details.average_satisfaction ?? null,
        wallTimeSec: details.wall_time_sec ?? null,
        branches: details.branches ?? null,
        conflicts: details.conflicts ?? null,

        nurses: (normalized as any)?.nurses?.length ?? null,
        days:
          (normalized as any)?.horizon?.days?.length ??
          (normalized as any)?.days?.length ??
          null,
        shifts: (normalized as any)?.shifts?.length ?? null,
      },
      notes: details?.post_fill?.note ?? null,
    };
  }

  /**
   * Determine if solver output should be treated as success.
   * Supports:
   * - feasible: boolean
   * - status: OPTIMAL/FEASIBLE/INFEASIBLE/UNKNOWN/TIMEOUT
   */
  private isSolveGood(out: SolverRawOutput): boolean {
    const feasibleFlag = (out as any).feasible;
    if (typeof feasibleFlag === 'boolean') return feasibleFlag;

    const status = String(
      (out as any).status ?? (out as any).meta?.status ?? '',
    ).toUpperCase();

    if (!status) {
      const n = Array.isArray((out as any).assignments)
        ? (out as any).assignments.length
        : 0;
      return n > 0;
    }

    if (status.includes('INFEAS')) return false;
    if (status.includes('TIME')) return false;
    if (status.includes('UNKNOWN')) return false;
    if (status.includes('FAIL')) return false;
    return true;
  }

  private extractFailureReason(out: SolverRawOutput): string | null {
    const status = (out as any).status ?? (out as any).meta?.status ?? null;
    const detailsRaw = (out as any).details ?? (out as any).meta?.note ?? null;

    if (typeof detailsRaw === 'string') return detailsRaw;
    if (detailsRaw != null) {
      try {
        return JSON.stringify(detailsRaw);
      } catch {
        return String(detailsRaw);
      }
    }
    return status != null ? String(status) : null;
  }

  /**
   * Preview contract:
   * preview.assignments = [{ workerId, date, shiftCode, source, attributes }]
   *
   * Your normalized "nurses" are codes like "N12", and meta has nurseCodeToWorkerId.
   */
  private async writePreviewFromSolverOutput(
    jobId: string,
    solverOutput: SolverRawOutput,
    meta: any,
  ) {
    const fresh = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!fresh) return;

    const scheduleId = fresh.attributes?.scheduleId ?? null;

    const nurseCodeToWorkerId: Record<string, string> =
      meta?.nurseCodeToWorkerId ?? meta?.mappings?.workerIdByNurseCode ?? {};

    const rawAssignments: any[] =
      (solverOutput as any).assignments ??
      (solverOutput as any).output?.assignments ??
      (solverOutput as any).solution?.assignments ??
      [];

    const assignments = rawAssignments
      .map((a) => {
        const date = String(a.date ?? a.day);
        const shiftCode = String(a.shiftCode ?? a.shift_code ?? a.shift);

        const nurseCode = a.nurse ?? a.nurseCode ?? a.nurse_code;
        const workerIdFromNurse =
          nurseCode != null ? nurseCodeToWorkerId[String(nurseCode)] : null;

        const workerId = a.workerId ?? a.worker_id ?? workerIdFromNurse ?? null;
        if (!workerId || !date || !shiftCode) return null;

        return {
          workerId: String(workerId),
          date,
          shiftCode,
          source: 'SOLVER',
          attributes: a.attributes ?? {},
        };
      })
      .filter(Boolean);

    const feasible =
      typeof (solverOutput as any).feasible === 'boolean'
        ? (solverOutput as any).feasible
        : this.isSolveGood(solverOutput);

    const preview = {
      scheduleId,
      summary: {
        note: 'Preview generated from OR-Tools solver output (Phase 2A/2B)',
        assignmentCount: assignments.length,
        feasible,
        status: (solverOutput as any).status ?? null,
      },
      assignments,
    };

    fresh.attributes = {
      ...(fresh.attributes ?? {}),
      preview,
    };

    await this.jobsRepo.save(fresh);
  }

  private basicEvaluate(
    normalized: NormalizedInputV1,
    solverOutput: SolverRawOutput,
    chosenPlan: SolverPlan,
  ) {
    const assignmentCount =
      (solverOutput as any).assignments?.length ??
      (solverOutput as any).solution?.assignments?.length ??
      0;

    const feasible =
      typeof (solverOutput as any).feasible === 'boolean'
        ? (solverOutput as any).feasible
        : this.isSolveGood(solverOutput);

    return {
      schema: 'EvaluationReport.v1',
      note: 'Phase 2A basic evaluation (expand later)',
      metrics: {
        feasible,
        chosenPlan,
        solverStatus: (solverOutput as any).status ?? null,
        assignmentCount,
        nurses: (normalized as any)?.nurses?.length ?? null,
        days:
          (normalized as any)?.horizon?.days?.length ??
          (normalized as any)?.days?.length ??
          null,
        shifts: (normalized as any)?.shifts?.length ?? null,
      },
    };
  }

  private async transition(
    jobId: string,
    from: ScheduleJobStatus,
    to: ScheduleJobStatus,
  ) {
    const res = await this.jobsRepo
      .createQueryBuilder()
      .update(ScheduleJob)
      .set({ status: to })
      .where('id = :jobId', { jobId })
      .andWhere('status = :from', { from })
      .execute();

    if (res.affected === 0) {
      this.logger.debug(`Skip transition ${from} -> ${to} job=${jobId}`);
    }
  }

  private async fail(jobId: string, err: any) {
    const message = String(err?.message ?? err ?? 'Unknown error');
    const code = err?.code ? String(err.code) : 'JOB_FAILED';

    await this.jobsRepo.update({ id: jobId }, {
      status: ScheduleJobStatus.FAILED,
      error_code: code,
      error_message: message.slice(0, 900),
    } as any);
  }

  private async writeArtifactJsonOnce(
    jobId: string,
    type: ScheduleArtifactType,
    json: Record<string, any>,
  ) {
    const existing = await this.artifactsRepo.findOne({
      where: { job_id: jobId, type } as any,
    });
    if (existing) return;

    const text = JSON.stringify(json);
    const sha = crypto.createHash('sha256').update(text).digest('hex');

    const artifact = this.artifactsRepo.create({
      job_id: jobId,
      type,
      storage_provider: 'db',
      bucket: null,
      object_key: null,
      content_type: 'application/json',
      content_sha256: sha,
      content_bytes: String(Buffer.byteLength(text)),
      metadata: json,
    });

    await this.artifactsRepo.save(artifact);
  }

  private async mergeJobAttributes(jobId: string, patch: Record<string, any>) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    job.attributes = {
      ...(job.attributes ?? {}),
      ...patch,
    };

    await this.jobsRepo.save(job);
  }
}
