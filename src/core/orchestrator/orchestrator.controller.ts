// src/core/orchestrator/orchestrator.controller.ts
import { Body, Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { JobsService } from '@/core/jobs/jobs.service';
import { RunOrchestratorDto } from './dto/run-orchestrator.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

@UseGuards(JwtAuthGuard)
@Controller('/orchestrator')
export class OrchestratorController {
  private readonly logger = new Logger(OrchestratorController.name);

  private readonly sfn = new SFNClient({
    region: process.env.AWS_REGION ?? 'ap-southeast-1',
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 2000,
      socketTimeout: 6000,
    }),
    maxAttempts: 2,
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

  @Post('/run')
  async run(@Body() body: RunOrchestratorDto) {
    const mode = this.getMode();
    const useStepFunctions = mode === 'STEP_FUNCTIONS';

    this.logger.log(`ORCH mode=${mode}`);

    const res = await this.jobs.createJob(
      body.scheduleId,
      body.dto as any,
      body.idempotencyKey ?? null,
      { enqueueLocalRunner: !useStepFunctions },
    );

    const job = res.job;

    if (!useStepFunctions) {
      return { ok: true, mode: 'LOCAL_RUNNER', job };
    }

    const stateMachineArn = this.getStateMachineArn();
    this.logger.log(`ORCH stateMachineArn=${stateMachineArn}`);

    const input = {
      scheduleId: body.scheduleId,
      dto: body.dto,
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
        execution: {
          arn: out.executionArn ?? null,
          startDate: out.startDate ? new Date(out.startDate).toISOString() : null,
          name: execName,
          stateMachineArn,
        },
      };
    } catch (e: any) {
      this.logger.error(`ORCH StartExecution failed: ${e?.name} ${e?.message}`);

      return {
        ok: false,
        mode: 'STEP_FUNCTIONS',
        job,
        error: {
          name: e?.name ?? 'StartExecutionError',
          message: e?.message ?? String(e),
        },
      };
    }
  }
}
