// src/workers/create-job.lambda.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { JobsService } from '@/core/jobs/jobs.service';

/**
 * Supports Step Functions input shapes like:
 * 1) { input: { scheduleId, idempotencyKey?, dto } }   (recommended)
 * 2) { scheduleId, idempotencyKey?, dto }              (direct invoke)
 *
 * dto must match CreateJobDto:
 * { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD", strategy?, solverConfig?, options?, notes? }
 */
type CreateJobWorkerInput = {
  scheduleId: string;
  idempotencyKey?: string | null;
  dto: {
    startDate: string;
    endDate: string;
    strategy?: Record<string, any>;
    solverConfig?: Record<string, any>;
    options?: Record<string, any>;
    notes?: string;
  };
};

let cachedApp: any;
let cachedJobsService: JobsService;

function extractInput(event: any): CreateJobWorkerInput {
  const maybe = event?.input ?? event;

  if (!maybe || typeof maybe !== 'object') {
    throw new Error('Invalid event: expected object input');
  }

  const scheduleId = maybe.scheduleId ?? maybe.schedule_id;
  const dto = maybe.dto ?? {
    startDate: maybe.startDate ?? maybe.start_date,
    endDate: maybe.endDate ?? maybe.end_date,
    strategy: maybe.strategy,
    solverConfig: maybe.solverConfig,
    options: maybe.options,
    notes: maybe.notes,
  };

  const idempotencyKey =
    maybe.idempotencyKey ?? maybe.idempotency_key ?? null;

  if (!scheduleId || typeof scheduleId !== 'string') {
    throw new Error('Missing required field: scheduleId');
  }
  if (!dto?.startDate || !dto?.endDate) {
    throw new Error('Missing required dto fields: startDate/endDate');
  }

  return { scheduleId, idempotencyKey, dto };
}

async function bootstrap() {
  if (cachedApp && cachedJobsService) return;

  cachedApp = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  cachedApp.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  cachedJobsService = cachedApp.get(JobsService);
}

export const handler = async (event: any) => {
  await bootstrap();

  const input = extractInput(event);

  // - Finds schedule by scheduleId
  // - Creates schedule_jobs row with REQUESTED + dates
  // - Links schedule.job_id = job.id
  // - Enqueues local runner (you may later replace that with Step Functions flow)
  const res = await cachedJobsService.createJob(
    input.scheduleId,
    input.dto as any,
    input.idempotencyKey ?? null,
  );

  return {
    ok: true,
    job: res.job,
  };
};
