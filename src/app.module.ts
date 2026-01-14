// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './core/auth/auth.module';
import { HealthModule } from './core/health/health.module';
import { DatabaseModule } from './database/database.module';
import { SchedulesModule } from './core/scheduling/scheduling.module';
import { JobsModule } from './core/jobs/jobs.module';
import { AvailabilityModule } from './core/availability/availability.module';
import { WorkersModule } from './core/workers/workers.module';
import { UnitConfigModule } from './core/unit-config/unit-config.module';
import { WorkerPreferencesModule } from './core/worker-preferences/worker-preferences.module';
import { ShiftTemplatesModule } from './core/unit-config/shift-templates/shift-templates.module';
import { ConstraintProfilesModule } from './core/unit-config/constraint-profiles/constraint-profiles.module';
import { NormalizerModule } from './core/normalizer/normalizer.module';
import { SolverModule } from './core/solver/solver.module';
import { CoverageRulesModule } from './core/unit-config/coverage-rules/coverage-rules.module';
import { WorkerMessagesModule } from './core/messages/worker-messages.module';
import { BucketsModule } from './database/buckets/buckets.module';
import { OrchestratorModule } from './core/orchestrator/orchestrator.module';
import { OrganizationsModule } from '@/core/organizations/organizations.module';
import { UnitsModule } from '@/core/units/units.module';
import { SitesModule } from '@/core/sites/sites.module';
import { RolesModule } from '@/core/roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    DatabaseModule,
    AuthModule,
    HealthModule,
    SchedulesModule,
    JobsModule,
    AvailabilityModule,
    WorkersModule,
    UnitConfigModule,
    WorkerPreferencesModule,
    ShiftTemplatesModule,
    ConstraintProfilesModule,
    NormalizerModule,
    SolverModule,
    CoverageRulesModule,
    WorkerMessagesModule,
    BucketsModule,
    OrchestratorModule,
    OrganizationsModule,
    UnitsModule,
    SitesModule,
    RolesModule,
  ],
})
export class AppModule {}
