// src/core/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { ScheduleAssignment } from '@/database/entities/scheduling/schedule-assignment.entity';
import { ScheduleJob } from '@/database/entities/orchestration/schedule-job.entity';
import { ScheduleArtifact } from '@/database/entities/orchestration/schedule-artifact.entity';

import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsRunnerService } from './jobs-runner.service';

import { NormalizerModule } from '@/core/normalizer/normalizer.module';
import { SolverModule } from '@/core/solver/solver.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Schedule,           
      ScheduleAssignment,
      ScheduleJob,
      ScheduleArtifact,
    ]),
    NormalizerModule,
    SolverModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsRunnerService],
  exports: [JobsService, JobsRunnerService],
})
export class JobsModule {}
