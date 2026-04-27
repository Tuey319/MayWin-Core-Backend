// src/core/webhook/chatbot-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ChatbotConversation } from '@/database/entities/workers/chatbot-conversation.entity';

/**
 * Nightly cleanup of expired chatbot conversations.
 * PDPA §26 data-minimisation — personal LINE message history must not be
 * retained beyond the 90-day window set at conversation creation (DATA-001).
 *
 * Requires @nestjs/schedule:
 *   npm install @nestjs/schedule
 * And ScheduleModule.forRoot() in AppModule.
 */
@Injectable()
export class ChatbotCleanupService {
  private readonly logger = new Logger(ChatbotCleanupService.name);

  constructor(
    @InjectRepository(ChatbotConversation)
    private readonly conversationsRepo: Repository<ChatbotConversation>,
  ) {}

  @Cron('0 2 * * *') // 02:00 server time every day
  async purgeExpiredConversations(): Promise<void> {
    const result = await this.conversationsRepo.delete({
      expires_at: LessThan(new Date()),
    });
    this.logger.log(
      `[CLEANUP] Purged ${result.affected ?? 0} expired chatbot conversation(s) (DATA-001)`,
    );
  }
}
