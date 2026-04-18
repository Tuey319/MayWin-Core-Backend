import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ensureCsvFile, parseCsv, toCsvLine } from '@/core/mock-csv/csv.util';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';
import { LEVEL_MAX, LEVEL_MIN, type LogLevel } from './dto/create-audit-log.dto';

export type AuditLogEntry = {
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  level: LogLevel;
};

/** Map backend JWT role strings to the highest level they may read (inclusive). */
const ROLE_MAX_LEVEL: Record<string, number> = {
  // backend role codes
  NURSE: 2,
  UNIT_MANAGER: 3,
  HEAD_NURSE: 3,
  ORG_ADMIN: 4,
  HOSPITAL_ADMIN: 4,
  SUPER_ADMIN: 6,
  // frontend normalised codes
  nurse: 2,
  head_nurse: 3,
  hospital_admin: 4,
  super_admin: 6,
};

/** Returns the highest level number the caller may read (0 = error only, 6 = all). */
export function callerMaxLevel(roles: string[]): number {
  let max = LEVEL_MIN;
  for (const r of roles) {
    const ceiling = ROLE_MAX_LEVEL[r] ?? ROLE_MAX_LEVEL[r.toUpperCase()] ?? LEVEL_MIN;
    if (ceiling > max) max = ceiling;
  }
  return max;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly logDir = process.env.AUDIT_LOG_DIR ?? '/tmp';
  private readonly header = [
    'timestamp',
    'actorId',
    'actorName',
    'action',
    'targetType',
    'targetId',
    'detail',
    'lvl',
  ];

  constructor(private readonly s3: S3ArtifactsService) {}

  private get useS3(): boolean {
    return !!(process.env.MAYWIN_ARTIFACTS_BUCKET?.trim());
  }

  private s3Key(orgId: string): string[] {
    return ['logs', orgId, 'audit-logs.csv'];
  }

  private localPath(orgId: string): string {
    return path.join(this.logDir, orgId, 'audit-logs.csv');
  }

  private async readFromS3(orgId: string): Promise<string> {
    const raw = await this.s3.getText(this.s3Key(orgId));
    if (raw != null) return raw;
    return `${toCsvLine(this.header)}\n`;
  }

  private async writeToS3(orgId: string, csv: string): Promise<void> {
    await this.s3.putText(this.s3Key(orgId), csv, 'text/csv; charset=utf-8');
  }

  private async ensureLocalFile(orgId: string): Promise<void> {
    const filePath = this.localPath(orgId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await ensureCsvFile(filePath, this.header);
  }

  private fromRow(row: string[]): AuditLogEntry {
    const raw = row[7];
    // Support legacy string levels from before the numeric migration
    const legacyMap: Record<string, number> = { INFO: 2, STAFF: 3, AUTH: 4, SECURITY: 5 };
    const level: LogLevel = raw != null && /^\d+$/.test(raw)
      ? Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, parseInt(raw, 10)))
      : (legacyMap[raw ?? ''] ?? 2);
    return {
      timestamp: row[0] ?? '',
      actorId: row[1] ?? '',
      actorName: row[2] ?? '',
      action: row[3] ?? '',
      targetType: row[4] ?? '',
      targetId: row[5] ?? '',
      detail: row[6] ?? '',
      level,
    };
  }

  /** Return entries the caller is allowed to see, newest first, plus their ceiling. */
  async listNewestFirst(orgId: string, callerRoles: string[] = []): Promise<{ entries: AuditLogEntry[]; maxLevel: number }> {
    const maxLvl = callerMaxLevel(callerRoles.length ? callerRoles : ['SUPER_ADMIN']);
    const raw = await this.readRawCsv(orgId);
    const rows = parseCsv(raw);
    const entries = rows
      .slice(1)
      .map((row) => this.fromRow(row))
      .filter((e) => e.level <= maxLvl)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { entries, maxLevel: maxLvl };
  }

  async append(entry: {
    orgId: string;
    actorId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string;
    detail: string;
    level?: LogLevel;
  }): Promise<AuditLogEntry> {
    const { orgId } = entry;
    const lvl = Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, entry.level ?? 2));
    const payload: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      detail: entry.detail,
      level: lvl,
    };

    const line = `${toCsvLine([
      payload.timestamp,
      payload.actorId,
      payload.actorName,
      payload.action,
      payload.targetType,
      payload.targetId,
      payload.detail,
      String(payload.level),
    ])}\n`;

    if (this.useS3) {
      const existing = await this.readFromS3(orgId);
      await this.writeToS3(orgId, existing + line);
      this.logger.debug(`Audit log appended to S3 (${this.s3Key(orgId).join('/')})`);
    } else {
      await this.ensureLocalFile(orgId);
      await fs.appendFile(this.localPath(orgId), line, 'utf8');
    }

    return payload;
  }

  async readRawCsv(orgId: string): Promise<string> {
    if (this.useS3) return this.readFromS3(orgId);
    await this.ensureLocalFile(orgId);
    return fs.readFile(this.localPath(orgId), 'utf8');
  }
}
