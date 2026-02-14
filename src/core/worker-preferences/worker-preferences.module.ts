// src/core/worker-preferences/worker-preferences.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';

import { WorkerPreferencesController } from './worker-preferences.controller';
import { WorkerPreferencesService } from './worker-preferences.service';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, WorkerUnitMembership, WorkerPreference])],
  controllers: [WorkerPreferencesController],
  providers: [WorkerPreferencesService],
})
export class WorkerPreferencesModule {}
