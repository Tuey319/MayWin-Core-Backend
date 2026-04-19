// src/core/staff/staff.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from '@/core/staff/staff.controller';
import { StaffService } from '@/core/staff/staff.service';
import { AuditLogsModule } from '@/core/audit-logs/audit-logs.module';
import { MailModule } from '@/core/mail/mail.module';
import { Worker } from '@/database/entities/workers/worker.entity';
import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { LineLinkToken } from '@/database/entities/workers/line-link-token.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';

@Module({
  imports: [
    AuditLogsModule,
    MailModule,
    TypeOrmModule.forFeature([Worker, User, UnitMembership, LineLinkToken, WorkerUnitMembership]),
  ],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule { }
