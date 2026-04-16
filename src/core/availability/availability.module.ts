// src/core/availability/availability.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkerAvailability } from '@/database/entities/workers/worker-availability.entity';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { AuditLogsModule } from '@/core/audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerAvailability]), AuditLogsModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
