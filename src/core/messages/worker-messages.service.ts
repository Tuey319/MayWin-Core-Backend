// src/core/messages/worker-messages.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { WorkerMessage } from '@/database/entities/workers/worker-message.entity';
import { CreateWorkerMessageDto } from './dto/create-worker-message.dto';
import { ListWorkerMessagesQueryDto } from './dto/list-worker-messages.query.dto';
import { CreateWorkerChatMessageDto } from './dto/create-worker-chat-message.dto';
import { Worker } from '@/database/entities/workers/worker.entity';

type SortDir = 'ASC' | 'DESC';

@Injectable()
export class WorkerMessagesService {
  constructor(
    @InjectRepository(WorkerMessage)
    private readonly repo: Repository<WorkerMessage>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) { }

  async create(workerId: string, dto: CreateWorkerMessageDto, user?: any) {
    // sender check (DB has check constraint; we validate early for clearer error)
    if (!dto.senderUserId && !dto.senderWorkerId) {
      throw new BadRequestException('Either senderUserId or senderWorkerId is required.');
    }

    const orgIdFromAuth =
      user?.organizationId ?? user?.orgId ?? user?.organization_id ?? null;

    const row = this.repo.create({
      worker_id: workerId,

      organization_id: String(dto.organizationId ?? orgIdFromAuth ?? ''),
      unit_id: dto.unitId ?? null,

      sender_user_id: dto.senderUserId ?? null,
      sender_worker_id: dto.senderWorkerId ?? null,

      direction: dto.direction ?? 'INBOUND',
      status: dto.status ?? 'SENT',

      subject: dto.subject ?? null,
      body: dto.body,

      job_id: dto.jobId ?? null,
      schedule_id: dto.scheduleId ?? null,
      shift_date: dto.shiftDate ?? null,
      shift_code: dto.shiftCode ?? null,

      attributes: dto.attributes ?? {},
    });

    if (!row.organization_id) {
      throw new BadRequestException(
        'organizationId is required (should come from auth context).',
      );
    }

    const saved = await this.repo.save(row);
    return saved;
  }

  /**
   * New "simple" create for frontend chat box.
   * Frontend sends only { body, subject? }.
   * Backend fills org/unit/sender/direction/status.
   */
  async createChat(workerId: string, dto: CreateWorkerChatMessageDto, user: any) {
    if (!user) throw new ForbiddenException('Missing auth context');

    const userId = user?.userId ?? user?.id ?? user?.sub ?? null;
    const orgIdFromAuth =
      user?.organizationId ?? user?.orgId ?? user?.organization_id ?? null;

    if (!userId) throw new ForbiddenException('Missing user id in auth context');
    if (!orgIdFromAuth) {
      throw new ForbiddenException('Missing organization id in auth context');
    }

    const worker = await this.workerRepo.findOne({
      where: { id: workerId as any },
      select: ['id', 'organization_id', 'primary_unit_id'] as any,
    });

    if (!worker) throw new NotFoundException('Worker not found');

    const workerOrgId = String((worker as any).organization_id ?? '');
    const authOrgId = String(orgIdFromAuth);

    if (workerOrgId && workerOrgId !== authOrgId) {
      throw new ForbiddenException('Cross-organization message not allowed');
    }

    const unitId =
      (worker as any).primary_unit_id != null
        ? String((worker as any).primary_unit_id)
        : null;


    const row = this.repo.create({
      worker_id: String((worker as any).id ?? workerId),
      organization_id: authOrgId,
      unit_id: unitId,

      sender_user_id: String(userId),
      sender_worker_id: null,

      direction: 'OUTBOUND',
      status: 'SENT',

      subject: dto.subject ?? null,
      body: dto.body,

      job_id: null,
      schedule_id: null,
      shift_date: null,
      shift_code: null,

      attributes: {},
    });

    const saved = await this.repo.save(row);

    return {
      id: saved.id,
      workerId: saved.worker_id,
      unitId: saved.unit_id,
      organizationId: saved.organization_id,
      senderUserId: saved.sender_user_id,
      direction: saved.direction,
      status: saved.status,
      subject: saved.subject,
      body: saved.body,
      createdAt: saved.created_at,
    };
  }

  async listByWorker(workerId: string, q: ListWorkerMessagesQueryDto) {
    const where: FindOptionsWhere<WorkerMessage> = {
      worker_id: workerId,
    };

    if (q.unitId) where.unit_id = q.unitId;
    if (q.jobId) where.job_id = q.jobId;
    if (q.status) where.status = q.status;
    if (q.direction) where.direction = q.direction;

    const { take, skip, order } = this.parsePaging(q);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { created_at: order },
      take,
      skip,
    });

    return { total, items, limit: take, offset: skip };
  }

  async listByUnit(unitId: string, q: ListWorkerMessagesQueryDto) {
    const where: FindOptionsWhere<WorkerMessage> = {
      unit_id: unitId,
    };

    if (q.jobId) where.job_id = q.jobId;
    if (q.status) where.status = q.status;
    if (q.direction) where.direction = q.direction;

    const { take, skip, order } = this.parsePaging(q);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { created_at: order },
      take,
      skip,
    });

    return { total, items, limit: take, offset: skip };
  }

  async listByJob(jobId: string, q: ListWorkerMessagesQueryDto) {
    const where: FindOptionsWhere<WorkerMessage> = {
      job_id: jobId,
    };

    if (q.unitId) where.unit_id = q.unitId;
    if (q.status) where.status = q.status;
    if (q.direction) where.direction = q.direction;

    const { take, skip, order } = this.parsePaging(q);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { created_at: order },
      take,
      skip,
    });

    return { total, items, limit: take, offset: skip };
  }

  private parsePaging(q: ListWorkerMessagesQueryDto) {
    const take = Math.min(parseInt(q.limit ?? '50', 10) || 50, 200);
    const skip = parseInt(q.offset ?? '0', 10) || 0;

    const sortRaw = (q.sort ?? 'DESC').toUpperCase();
    const order: SortDir = sortRaw === 'ASC' ? 'ASC' : 'DESC';

    return { take, skip, order };
  }
}
