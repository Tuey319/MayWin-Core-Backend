// src/core/units/units.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unit } from '@/database/entities/core/unit.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { Worker } from '@/database/entities/workers/worker.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [TypeOrmModule.forFeature([Unit, UnitMembership, WorkerUnitMembership, Worker])],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
