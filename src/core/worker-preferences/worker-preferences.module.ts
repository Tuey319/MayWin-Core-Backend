// src/core/worker-preferences/worker-preferences.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerAvailability } from '@/database/entities/workers/worker-availability.entity';


import { WorkerPreferencesController } from './worker-preferences.controller';
import { WorkerPreferencesService } from './worker-preferences.service';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';

import { forwardRef } from '@nestjs/common';
import { JobsModule } from '@/core/jobs/jobs.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, WorkerUnitMembership, WorkerPreference, WorkerAvailability]),
    forwardRef(() => JobsModule),
    forwardRef(() => WebhookModule),
  ],
  controllers: [WorkerPreferencesController],
  providers: [WorkerPreferencesService],
  exports: [WorkerPreferencesService],
})
export class WorkerPreferencesModule {}
