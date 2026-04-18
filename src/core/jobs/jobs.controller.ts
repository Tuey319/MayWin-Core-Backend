// src/core/jobs/jobs.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';

@Roles('HEAD_NURSE')
@UseGuards(JwtAuthGuard)
@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  // ISO 27001:2022 A.5.15 — org ownership verified in service
  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Post('/schedules/:scheduleId/jobs')
  createJob(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: CreateJobDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: any,
  ) {
    return this.jobs.createJob(scheduleId, dto, idempotencyKey ?? null, undefined, Number(req.user?.organizationId));
  }

  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/jobs/:jobId')
  getJob(@Param('jobId') jobId: string, @Req() req: any) {
    return this.jobs.getJob(jobId, Number(req.user?.organizationId));
  }

  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/schedule-jobs/:jobId')
  getScheduleJob(@Param('jobId') jobId: string, @Req() req: any) {
    return this.jobs.getJob(jobId, Number(req.user?.organizationId));
  }

  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Get('/jobs/:jobId/artifacts')
  listArtifacts(@Param('jobId') jobId: string, @Req() req: any) {
    return this.jobs.listArtifacts(jobId, Number(req.user?.organizationId));
  }

  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Get('/jobs/:jobId/solver-payload')
  getSolverPayload(@Param('jobId') jobId: string, @Req() req: any) {
    return this.jobs.getSolverPayload(jobId, Number(req.user?.organizationId));
  }

  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/jobs/:jobId/preview')
  preview(@Param('jobId') jobId: string, @Req() req: any) {
    return this.jobs.preview(jobId, Number(req.user?.organizationId));
  }

  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Post('/jobs/:jobId/apply')
  apply(@Param('jobId') jobId: string, @Body() dto: ApplyJobDto, @Req() req: any) {
    return this.jobs.apply(jobId, dto.overwriteManualChanges ?? false, Number(req.user?.organizationId));
  }

  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Post('/jobs/:jobId/cancel')
  cancel(@Param('jobId') jobId: string, @Req() req: any) {
    return this.jobs.cancel(jobId, Number(req.user?.organizationId));
  }
}
