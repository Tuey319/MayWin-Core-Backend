import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from '@/core/staff/staff.controller';
import { StaffService } from '@/core/staff/staff.service';
import { AuditLogsModule } from '@/core/audit-logs/audit-logs.module';
import { Worker } from '@/database/entities/workers/worker.entity';

@Module({
  imports: [AuditLogsModule, TypeOrmModule.forFeature([Worker])],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
