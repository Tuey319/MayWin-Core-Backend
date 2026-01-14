// src/core/messages/worker-messages.controller.ts
import { Body, Controller, Get, Param, Post, Query, UseGuards, Req } from '@nestjs/common';
import { WorkerMessagesService } from './worker-messages.service';
import { CreateWorkerMessageDto } from './dto/create-worker-message.dto';
import { ListWorkerMessagesQueryDto } from './dto/list-worker-messages.query.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CreateWorkerChatMessageDto } from './dto/create-worker-chat-message.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class WorkerMessagesController {
  constructor(private readonly svc: WorkerMessagesService) {}

  // POST /workers/:workerId/messages
  @Post('/workers/:workerId/messages')
  createForWorker(
    @Param('workerId') workerId: string,
    @Body() dto: CreateWorkerMessageDto,
    @Req() req: any,
  ) {
    return this.svc.create(workerId, dto, req.user);
  }

  // POST /workers/:workerId/messages/chat
  @Post('/workers/:workerId/messages/chat')
  createChatForWorker(
    @Param('workerId') workerId: string,
    @Body() dto: CreateWorkerChatMessageDto,
    @Req() req: any,
  ) {
    return this.svc.createChat(workerId, dto, req.user);
  }

  // GET /workers/:workerId/messages
  @Get('/workers/:workerId/messages')
  listForWorker(
    @Param('workerId') workerId: string,
    @Query() q: ListWorkerMessagesQueryDto,
  ) {
    return this.svc.listByWorker(workerId, q);
  }

  // GET /units/:unitId/messages
  @Get('/units/:unitId/messages')
  listForUnit(
    @Param('unitId') unitId: string,
    @Query() q: ListWorkerMessagesQueryDto,
  ) {
    return this.svc.listByUnit(unitId, q);
  }

  // GET /jobs/:jobId/messages
  @Get('/jobs/:jobId/messages')
  listForJob(
    @Param('jobId') jobId: string,
    @Query() q: ListWorkerMessagesQueryDto,
  ) {
    return this.svc.listByJob(jobId, q);
  }
}
