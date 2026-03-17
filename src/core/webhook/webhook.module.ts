
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ChatbotConversation } from '../../database/entities/workers/chatbot-conversation.entity';
import { WorkerAvailability } from '../../database/entities/workers/worker-availability.entity';
import { Worker } from '../../database/entities/workers/worker.entity';
import { LineLinkToken } from '../../database/entities/workers/line-link-token.entity';
import { WorkerPreferencesModule } from '../worker-preferences/worker-preferences.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatbotConversation, WorkerAvailability, Worker, LineLinkToken]),
    forwardRef(() => WorkerPreferencesModule),
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule { }
