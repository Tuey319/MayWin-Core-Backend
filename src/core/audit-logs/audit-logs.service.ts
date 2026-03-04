import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ensureCsvFile, parseCsv, toCsvLine } from '@/core/mock-csv/csv.util';

type AuditLogEntry = {
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
};

@Injectable()
export class AuditLogsService {
  private readonly filePath = path.join(process.env.AUDIT_LOG_DIR ?? '/tmp', 'audit-logs.csv');
  private readonly header = [
    'timestamp',
    'actorId',
    'actorName',
    'action',
    'targetType',
    'targetId',
    'detail',
  ];

  private async ensureFile() {
    await ensureCsvFile(this.filePath, this.header);
  }

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
    await this.ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf8');
    const rows = parseCsv(raw);
    const dataRows = rows.slice(1).map((row) => this.fromRow(row));

    return dataRows.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
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
    await this.ensureFile();

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

    await fs.appendFile(this.filePath, line, 'utf8');
    return payload;
  }

  async readRawCsv(): Promise<string> {
    await this.ensureFile();
    return fs.readFile(this.filePath, 'utf8');
  }
}
