// src/core/workers/workers.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';
import { ScheduleJob } from '@/database/entities/orchestration/schedule-job.entity';
import { ScheduleArtifact } from '@/database/entities/orchestration/schedule-artifact.entity';
import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { ScheduleAssignment } from '@/database/entities/scheduling/schedule-assignment.entity';
import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { BucketsModule } from '@/database/buckets/buckets.module';
import { AuditLogsModule } from '@/core/audit-logs/audit-logs.module';

import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Worker,
      WorkerUnitMembership,
      WorkerPreference,
      ScheduleJob,
      ScheduleArtifact,
      Schedule,
      ScheduleAssignment,
      ShiftTemplate,
    ]),
    BucketsModule,
    AuditLogsModule,
  ],
  controllers: [WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}
