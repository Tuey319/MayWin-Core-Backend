import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NormalizerService } from './normalizer.service';

import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { ScheduleJob } from '@/database/entities/orchestration/schedule-job.entity';
import { CoverageRule } from '@/database/entities/scheduling/coverage-rule.entity';
import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';
import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { WorkerAvailability } from '@/database/entities/workers/worker-availability.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preference.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Schedule,
      ScheduleJob,
      CoverageRule,
      ConstraintProfile,
      ShiftTemplate,
      Worker,
      WorkerUnitMembership,
      WorkerAvailability,
      WorkerPreference,
    ]),
  ],
  providers: [NormalizerService],
  exports: [NormalizerService],
})
export class NormalizerModule {}
