// src/core/staff/staff.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from '@/core/staff/staff.controller';
import { StaffService } from '@/core/staff/staff.service';
import { DataSubjectService } from '@/core/staff/data-subject.service';
import { AuditLogsModule } from '@/core/audit-logs/audit-logs.module';
import { MailModule } from '@/core/mail/mail.module';
import { Worker } from '@/database/entities/workers/worker.entity';
import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { LineLinkToken } from '@/database/entities/workers/line-link-token.entity';
import { WorkerAvailability } from '@/database/entities/workers/worker-availability.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';
import { ChatbotConversation } from '@/database/entities/workers/chatbot-conversation.entity';

@Module({
  imports: [
    AuditLogsModule,
    MailModule,
    TypeOrmModule.forFeature([
      Worker,
      User,
      UnitMembership,
      LineLinkToken,
      WorkerAvailability,
      WorkerPreference,
      ChatbotConversation,
    ]),
  ],
  controllers: [StaffController],
  providers: [StaffService, DataSubjectService],
})
export class StaffModule { }
