// src/core/orchestrator/orchestrator.controller.ts
import { Body, Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { JobsService } from '@/core/jobs/jobs.service';
import { RunOrchestratorDto } from './dto/run-orchestrator.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

@Roles('UNIT_MANAGER', 'ORG_ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('/orchestrator')
export class OrchestratorController {
  private readonly logger = new Logger(OrchestratorController.name);

  private readonly sfn = new SFNClient({
    region: process.env.AWS_REGION ?? 'ap-southeast-1',
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10000,
      socketTimeout: 20000,
    }),
    maxAttempts: 3,
  });

  constructor(private readonly jobs: JobsService) {}

  private getMode(): 'STEP_FUNCTIONS' | 'LOCAL_RUNNER' {
    const raw =
      process.env.ORCHESTRATION_MODE ??
      process.env.MAYWIN_ORCHESTRATION_MODE ??
      'LOCAL_RUNNER';

    const mode = String(raw).trim().toUpperCase();
    return mode === 'STEP_FUNCTIONS' ? 'STEP_FUNCTIONS' : 'LOCAL_RUNNER';
  }

  private getStateMachineArn(): string {
    const raw =
      process.env.SCHEDULE_WORKFLOW_ARN ??
      process.env.MAYWIN_SFN_ARN ??
      '';

    const v = String(raw).trim();

    if (v.startsWith('aws:states:')) return `arn:${v}`;
    if (v.startsWith('states:')) return `arn:aws:${v}`;

    return v;
  }

  private computeEndDateFromLength(startDateIso: string, length: number): string {
    if (!Number.isFinite(length) || length <= 0) {
      throw new Error('dto.length must be a positive number of days');
    }

    const start = new Date(startDateIso);
    if (Number.isNaN(start.getTime())) {
      throw new Error('Invalid dto.startDate (must be ISO string)');
    }

    // Inclusive window: length=1 => same day
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + (Math.trunc(length) - 1));

    // Match your existing pattern: end-of-day UTC
    end.setUTCHours(23, 59, 59, 999);
    return end.toISOString();
  }

  private normalizeDtoForJob(dto: any): any {
    const out = { ...(dto ?? {}) };

    if (!out.startDate) {
      throw new Error('Missing required dto field: startDate');
    }

    // Accept either endDate or length
    if (!out.endDate) {
      if (out.length == null) {
        throw new Error('Missing required dto field: endDate (or provide length)');
      }
      out.endDate = this.computeEndDateFromLength(String(out.startDate), Number(out.length));
    }

    return out;
  }

  @Post('/run')
  async run(@Body() body: RunOrchestratorDto) {
    const mode = this.getMode();
    const useStepFunctions = mode === 'STEP_FUNCTIONS';

    this.logger.log(`ORCH mode=${mode}`);

    const normalizedDto = this.normalizeDtoForJob(body.dto);

    const res = await this.jobs.createJob(
      body.scheduleId,
      normalizedDto as any,
      body.idempotencyKey ?? null,
      { enqueueLocalRunner: !useStepFunctions },
    );

    const job = res.job;

    if (!useStepFunctions) {
      return {
        ok: true,
        mode: 'LOCAL_RUNNER',
        job,
        jobId: job?.id ?? null,
        executionArn: null,
      };
    }

    const stateMachineArn = this.getStateMachineArn();
    this.logger.log(`ORCH stateMachineArn=${stateMachineArn}`);

    const input = {
      scheduleId: body.scheduleId,
      dto: normalizedDto,
      idempotencyKey: body.idempotencyKey ?? null,
      jobId: job?.id ?? null,
    };

    const execName = `job-${job.id}-${Date.now()}`;

    this.logger.log(`ORCH about to StartExecution name=${execName}`);

    try {
      const out = await this.sfn.send(
        new StartExecutionCommand({
          stateMachineArn,
          name: execName,
          input: JSON.stringify(input),
        }),
      );

      this.logger.log(`ORCH StartExecution OK arn=${out.executionArn}`);

      return {
        ok: true,
        mode: 'STEP_FUNCTIONS',
        job,
        jobId: job?.id ?? null,
        executionArn: out.executionArn ?? null,
        execution: {
          arn: out.executionArn ?? null,
          startDate: out.startDate ? new Date(out.startDate).toISOString() : null,
          name: execName,
          stateMachineArn,
        },
      };
    } catch (e: any) {
      // ISO 27001:2022 A.8.12 — log full details server-side; never return AWS ARNs/messages to client
      this.logger.error(`ORCH StartExecution failed: ${e?.name} ${e?.message}`, e?.stack);

      return {
        ok: false,
        mode: 'STEP_FUNCTIONS',
        job,
        jobId: job?.id ?? null,
        executionArn: null,
        error: 'Scheduling engine is temporarily unavailable. Please try again.',
      };
    }
  }
}
