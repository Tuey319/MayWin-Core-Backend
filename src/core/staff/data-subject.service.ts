// src/core/staff/data-subject.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerAvailability } from '@/database/entities/workers/worker-availability.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';
import { ChatbotConversation } from '@/database/entities/workers/chatbot-conversation.entity';
import { AuditLogsService } from '@/core/audit-logs/audit-logs.service';

/**
 * Implements PDPA §33 right-to-erasure for worker personal data.
 *
 * The worker shell row and schedule assignments are intentionally retained
 * for aggregate analytics — no personal identifiers survive after erasure.
 */
@Injectable()
export class DataSubjectService {
  constructor(
    @InjectRepository(Worker)
    private readonly workersRepo: Repository<Worker>,

    @InjectRepository(WorkerAvailability)
    private readonly availabilityRepo: Repository<WorkerAvailability>,

    @InjectRepository(WorkerPreference)
    private readonly preferencesRepo: Repository<WorkerPreference>,

    @InjectRepository(ChatbotConversation)
    private readonly conversationsRepo: Repository<ChatbotConversation>,

    private readonly auditLogs: AuditLogsService,
  ) {}

  async eraseWorker(workerId: string, requestedBy: string): Promise<{ erased: true; workerId: string }> {
    const worker = await this.workersRepo.findOne({ where: { id: workerId as any } });
    if (!worker) throw new NotFoundException('Worker not found');

    // PDPA §33 — write erasure-request audit log BEFORE any data modification so the
    // intent is recorded even if a subsequent step fails
    await this.auditLogs.append({
      orgId: String(worker.organization_id),
      actorId: requestedBy,
      actorName: requestedBy,
      action: 'GDPR_ERASURE_REQUEST',
      targetType: 'worker',
      targetId: workerId,
      detail: 'Personal data erasure requested',
      level: 4,
    });

    // Anonymise identifying fields on the worker row
    worker.full_name = 'ERASED';
    worker.line_id = null;
    const attrs = { ...(worker.attributes ?? {}) };
    delete attrs.email;
    delete attrs.phone;
    worker.attributes = attrs;
    await this.workersRepo.save(worker);

    // Delete all personally-linked child records
    await this.availabilityRepo.delete({ worker_id: workerId });
    await this.preferencesRepo.delete({ worker_id: workerId });
    await this.conversationsRepo.delete({ worker_id: workerId });

    // Write completion audit log — provides evidence of erasure for PDPA §33 accountability
    await this.auditLogs.append({
      orgId: String(worker.organization_id),
      actorId: requestedBy,
      actorName: requestedBy,
      action: 'GDPR_ERASURE_COMPLETE',
      targetType: 'worker',
      targetId: workerId,
      detail: 'Erasure complete: availability, preferences and chatbot conversations deleted; full_name anonymised, email/phone/line_id nulled',
      level: 4,
    });

    return { erased: true, workerId };
  }
}
