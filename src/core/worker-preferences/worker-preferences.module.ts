// src/core/worker-preferences/worker-preferences.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';

import { WorkerPreferencesController } from './worker-preferences.controller';
import { WorkerPreferencesService } from './worker-preferences.service';

@Module({
  imports: [TypeOrmModule.forFeature([Worker])],
  controllers: [WorkerPreferencesController],
  providers: [WorkerPreferencesService],
})
export class WorkerPreferencesModule {}
