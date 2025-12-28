// src/core/jobs/jobs.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  // Purpose: Request async schedule generation (returns immediately). :contentReference[oaicite:23]{index=23}
  @Post('/schedules/:scheduleId/jobs')
  createJob(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: CreateJobDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.jobs.createJob(scheduleId, dto, idempotencyKey ?? null);
  }

  // Purpose: Poll job status + phase. :contentReference[oaicite:24]{index=24}
  @Get('/jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.jobs.getJob(jobId);
  }

  // Purpose: List job artifacts. :contentReference[oaicite:25]{index=25}
  @Get('/jobs/:jobId/artifacts')
  listArtifacts(@Param('jobId') jobId: string) {
    return this.jobs.listArtifacts(jobId);
  }

  // Purpose: Preview solver results (read-only). :contentReference[oaicite:26]{index=26}
  @Get('/jobs/:jobId/preview')
  preview(@Param('jobId') jobId: string) {
    return this.jobs.preview(jobId);
  }

  // Purpose: Apply solver results into schedule (commit). :contentReference[oaicite:27]{index=27}
  @Post('/jobs/:jobId/apply')
  apply(@Param('jobId') jobId: string, @Body() dto: ApplyJobDto) {
    return this.jobs.apply(jobId, dto.overwriteManualChanges ?? false);
  }

  // Purpose: Cancel in-progress job, schedule unchanged. :contentReference[oaicite:28]{index=28}
  @Post('/jobs/:jobId/cancel')
  cancel(@Param('jobId') jobId: string) {
    return this.jobs.cancel(jobId);
  }
}
