// src/core/workers/workers.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preference.entity';

import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, WorkerUnitMembership, WorkerPreference])],
  controllers: [WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}
