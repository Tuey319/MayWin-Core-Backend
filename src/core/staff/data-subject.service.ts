// src/core/staff/data-subject.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerAvailability } from '@/database/entities/workers/worker-availability.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';
import { ChatbotConversation } from '@/database/entities/workers/chatbot-conversation.entity';
import { LineLinkToken } from '@/database/entities/workers/line-link-token.entity';
import { AuditLogsService } from '@/core/audit-logs/audit-logs.service';

/**
 * Implements PDPA §33 right-to-erasure for worker personal data.
 *
 * The worker shell row and schedule assignments are intentionally retained
 * for aggregate analytics — no personal identifiers survive after erasure.
 */
@Injectable()
export class DataSubjectService {
  private readonly logger = new Logger(DataSubjectService.name);
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION });

  constructor(
    @InjectRepository(Worker)
    private readonly workersRepo: Repository<Worker>,

    @InjectRepository(WorkerAvailability)
    private readonly availabilityRepo: Repository<WorkerAvailability>,

    @InjectRepository(WorkerPreference)
    private readonly preferencesRepo: Repository<WorkerPreference>,

    @InjectRepository(ChatbotConversation)
    private readonly conversationsRepo: Repository<ChatbotConversation>,

    @InjectRepository(LineLinkToken)
    private readonly lineLinkTokensRepo: Repository<LineLinkToken>,

    private readonly auditLogs: AuditLogsService,
  ) {}

  async eraseWorker(workerId: string, requestedBy: string): Promise<{ erased: true; workerId: string }> {
    const worker = await this.workersRepo.findOne({ where: { id: workerId as any } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Resolve S3 avatar key before touching any data so the pre-erasure audit
    // record can name exactly what will be deleted.
    const avatarUrl: string | null =
      worker.attributes?.avatarUrl ?? worker.attributes?.avatar_url ?? null;
    const s3Key = avatarUrl ? this.extractS3Key(avatarUrl) : null;

    // PDPA §33 — write erasure-request audit log BEFORE any data modification so the
    // intent is recorded even if a subsequent step fails
    await this.auditLogs.append({
      orgId: String(worker.organization_id),
      actorId: requestedBy,
      actorName: requestedBy,
      action: 'GDPR_ERASURE_REQUEST',
      targetType: 'worker',
      targetId: workerId,
      detail: [
        'Personal data erasure requested.',
        s3Key
          ? `S3 avatar scheduled for deletion (key: ${s3Key}).`
          : 'No S3 avatar found.',
        'LINE link tokens scheduled for deletion.',
      ].join(' '),
      level: 4,
    });

    // ── S3 avatar deletion ───────────────────────────────────────────────────
    // Non-fatal: a missing or inaccessible object must not abort the erasure.
    // A warning is logged so ops can perform manual cleanup if required.
    let s3Deleted = false;
    if (s3Key) {
      const bucket = process.env.MAYWIN_ARTIFACTS_BUCKET;
      if (bucket) {
        try {
          await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));
          s3Deleted = true;
          this.logger.log(`[ERASURE] S3 avatar deleted for worker ${workerId} (key: ${s3Key})`);
        } catch (err) {
          this.logger.warn(
            `[ERASURE] S3 avatar deletion failed for worker ${workerId} (key: ${s3Key}): ${(err as Error).message} — manual cleanup required`,
          );
        }
      } else {
        this.logger.warn(
          `[ERASURE] MAYWIN_ARTIFACTS_BUCKET not configured — S3 avatar skipped for worker ${workerId}`,
        );
      }
    }

    // ── Anonymise identifying fields on the worker row ───────────────────────
    worker.full_name = 'ERASED';
    worker.line_id = null;
    const attrs = { ...(worker.attributes ?? {}) };
    delete attrs.email;
    delete attrs.phone;
    delete attrs.avatarUrl;
    delete attrs.avatar_url;
    worker.attributes = attrs;
    await this.workersRepo.save(worker);

    // ── Delete all personally-linked child records ───────────────────────────
    await this.availabilityRepo.delete({ worker_id: workerId });
    await this.preferencesRepo.delete({ worker_id: workerId });
    await this.conversationsRepo.delete({ worker_id: workerId });
    await this.lineLinkTokensRepo.delete({ worker_id: workerId });

    // Write completion audit log — provides evidence of erasure for PDPA §33 accountability
    await this.auditLogs.append({
      orgId: String(worker.organization_id),
      actorId: requestedBy,
      actorName: requestedBy,
      action: 'GDPR_ERASURE_COMPLETE',
      targetType: 'worker',
      targetId: workerId,
      detail: [
        'Erasure complete:',
        'availability, preferences, chatbot conversations, and LINE link tokens deleted;',
        s3Key
          ? (s3Deleted
              ? `S3 avatar deleted (key: ${s3Key});`
              : `S3 avatar deletion failed — manual cleanup required (key: ${s3Key});`)
          : 'no S3 avatar present;',
        'full_name anonymised; email, phone, line_id, and avatarUrl nulled.',
      ].join(' '),
      level: 4,
    });

    return { erased: true, workerId };
  }

  /**
   * Extracts the object key from a virtual-hosted S3 URL.
   * Handles: https://<bucket>.s3[.region].amazonaws.com/<key>
   * Returns null if the URL is not a recognisable S3 URL.
   */
  private extractS3Key(url: string): string | null {
    try {
      const { hostname, pathname } = new URL(url);
      if (hostname.endsWith('.amazonaws.com')) {
        const key = pathname.replace(/^\//, '');
        return key || null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
