import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { typeOrmConfig } from './typeorm.config';

// Core
import { Organization } from './entities/core/organization.entity';
import { Role } from './entities/core/role.entity';
import { Site } from './entities/core/site.entity';
import { Unit } from './entities/core/unit.entity';

// Users
import { User } from './entities/users/user.entity';
import { UserRole } from './entities/users/user-role.entity';
import { UnitMembership } from './entities/users/unit-membership.entity';

// Workers
import { Worker } from './entities/workers/worker.entity';
import { WorkerUnitMembership } from './entities/workers/worker-unit.entity';
import { WorkerAvailability } from './entities/workers/worker-availability.entity';
import { WorkerPreference } from './entities/workers/worker-preference.entity';

// Scheduling
import { ShiftTemplate } from './entities/scheduling/shift-template.entity';
import { CoverageRule } from './entities/scheduling/coverage-rule.entity';
import { ConstraintProfile } from './entities/scheduling/constraint-profile.entity';
import { Schedule } from './entities/scheduling/schedule.entity';
import { ScheduleAssignment } from './entities/scheduling/schedule-assignment.entity';

// Orchestration
import { ScheduleJob } from './entities/orchestration/schedule-job.entity';
import { ScheduleArtifact } from './entities/orchestration/schedule-artifact.entity';
import { ScheduleJobEvent } from './entities/orchestration/schedule-job-event.entity';
import { SolverRun } from './entities/orchestration/solver-run.entity';
import { SolverRunAssignment } from './entities/orchestration/solver-run-assignment.entity';

const ENTITIES = [
  Organization,
  Role,
  Site,
  Unit,

  User,
  UserRole,
  UnitMembership,

  Worker,
  WorkerUnitMembership,
  WorkerAvailability,
  WorkerPreference,

  ShiftTemplate,
  CoverageRule,
  ConstraintProfile,
  Schedule,
  ScheduleAssignment,

  ScheduleJob,
  ScheduleArtifact,
  ScheduleJobEvent,
  SolverRun,
  SolverRunAssignment,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...typeOrmConfig(),
        entities: ENTITIES,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
