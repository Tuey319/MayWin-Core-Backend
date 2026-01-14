// src/core/messages/worker-messages.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerMessage } from '@/database/entities/workers/worker-message.entity';
import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerMessagesService } from './worker-messages.service';
import { WorkerMessagesController } from './worker-messages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerMessage, Worker])],
  providers: [WorkerMessagesService],
  controllers: [WorkerMessagesController],
  exports: [WorkerMessagesService],
})
export class WorkerMessagesModule {}
