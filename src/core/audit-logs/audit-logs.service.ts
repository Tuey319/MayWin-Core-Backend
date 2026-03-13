import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ensureCsvFile, parseCsv, toCsvLine } from '@/core/mock-csv/csv.util';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';

type AuditLogEntry = {
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
};

const S3_KEY = ['logs', 'audit-logs.csv'];

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly localPath = path.join(process.env.AUDIT_LOG_DIR ?? '/tmp', 'audit-logs.csv');
  private readonly header = [
    'timestamp',
    'actorId',
    'actorName',
    'action',
    'targetType',
    'targetId',
    'detail',
  ];

  constructor(private readonly s3: S3ArtifactsService) {}

  private get useS3(): boolean {
    return !!(process.env.MAYWIN_ARTIFACTS_BUCKET?.trim());
  }

  // ── S3 helpers ────────────────────────────────────────────────────────────

  private async readFromS3(): Promise<string> {
    const raw = await this.s3.getText(S3_KEY);
    if (raw != null) return raw;
    // Object doesn't exist yet — return just the header
    return `${toCsvLine(this.header)}\n`;
  }

  private async writeToS3(csv: string): Promise<void> {
    await this.s3.putText(S3_KEY, csv, 'text/csv; charset=utf-8');
  }

  // ── Local-file helpers (fallback) ─────────────────────────────────────────

  private async ensureLocalFile() {
    await ensureCsvFile(this.localPath, this.header);
  }

  // ── Shared logic ──────────────────────────────────────────────────────────

  private fromRow(row: string[]): AuditLogEntry {
    return {
      timestamp: row[0] ?? '',
      actorId: row[1] ?? '',
      actorName: row[2] ?? '',
      action: row[3] ?? '',
      targetType: row[4] ?? '',
      targetId: row[5] ?? '',
      detail: row[6] ?? '',
    };
  }

  async listNewestFirst(): Promise<AuditLogEntry[]> {
    const raw = await this.readRawCsv();
    const rows = parseCsv(raw);
    const dataRows = rows.slice(1).map((row) => this.fromRow(row));

    return dataRows.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  async append(entry: {
    actorId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string;
    detail: string;
  }): Promise<AuditLogEntry> {
    const payload: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      detail: entry.detail,
    };

    const line = `${toCsvLine([
      payload.timestamp,
      payload.actorId,
      payload.actorName,
      payload.action,
      payload.targetType,
      payload.targetId,
      payload.detail,
    ])}\n`;

    if (this.useS3) {
      const existing = await this.readFromS3();
      await this.writeToS3(existing + line);
      this.logger.debug(`Audit log appended to S3 (${S3_KEY.join('/')})`);
    } else {
      await this.ensureLocalFile();
      await fs.appendFile(this.localPath, line, 'utf8');
    }

    return payload;
  }

  async readRawCsv(): Promise<string> {
    if (this.useS3) {
      return this.readFromS3();
    }
    await this.ensureLocalFile();
    return fs.readFile(this.localPath, 'utf8');
  }
}
