// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { RolesGuard } from '@/common/guards/roles.guard';
import { HttpLoggerMiddleware } from '@/common/middleware/http-logger.middleware';

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
import { WebhookModule } from '@/core/webhook/webhook.module';
import { StaffModule } from '@/core/staff/staff.module';
import { AuditLogsModule } from '@/core/audit-logs/audit-logs.module';
import { ProfilesModule } from '@/core/profiles/profiles.module';
import { DisplaySettingsModule } from '@/core/display-settings/display-settings.module';
import { ExportOptionsModule } from '@/core/export-options/export-options.module';

@Module({
  providers: [
    // RolesGuard is registered globally so @Roles() works on every controller
    // without needing @UseGuards(RolesGuard) per file.
    // JwtAuthGuard is still applied per-controller (explicit opt-in).
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 5 * 60 * 1000, // 5 minutes default TTL (ms)
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
    WebhookModule,
    StaffModule,
    AuditLogsModule,
    ProfilesModule,
    DisplaySettingsModule,
    ExportOptionsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
