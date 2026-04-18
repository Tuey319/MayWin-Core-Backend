// jest.mock is hoisted before imports, so the factory must be fully self-contained.
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    appendFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
  },
}));

import { promises as fsp } from 'fs';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService, callerMaxLevel } from './audit-logs.service';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';
import { toCsvLine } from '@/core/mock-csv/csv.util';

// ── helpers ───────────────────────────────────────────────────────────────────

const HEADER = 'timestamp,actorId,actorName,action,targetType,targetId,detail,lvl';

function makeCsv(...rows: string[][]): string {
  const lines = [HEADER, ...rows.map((r) => toCsvLine(r))];
  return lines.join('\n') + '\n';
}

function makeRow(overrides: Partial<Record<string, string>> = {}): string[] {
  return [
    overrides.timestamp ?? new Date().toISOString(),
    overrides.actorId ?? 'user-1',
    overrides.actorName ?? 'Alice',
    overrides.action ?? 'CREATE_STAFF',
    overrides.targetType ?? 'staff',
    overrides.targetId ?? 'EMP001',
    overrides.detail ?? 'some detail',
    overrides.level ?? '3',
  ];
}

const mockS3 = {
  getText: jest.fn(),
  putText: jest.fn().mockResolvedValue(undefined),
};

// ── callerMaxLevel ────────────────────────────────────────────────────────────

describe('callerMaxLevel', () => {
  it('returns 0 for unknown roles', () => {
    expect(callerMaxLevel(['UNKNOWN_ROLE'])).toBe(0);
  });

  it('returns 5 for NURSE', () => {
    expect(callerMaxLevel(['NURSE'])).toBe(5);
  });

  it('returns 6 for HEAD_NURSE', () => {
    expect(callerMaxLevel(['HEAD_NURSE'])).toBe(6);
  });

  it('returns 6 for HOSPITAL_ADMIN', () => {
    expect(callerMaxLevel(['HOSPITAL_ADMIN'])).toBe(6);
  });

  it('returns 7 for SUPER_ADMIN', () => {
    expect(callerMaxLevel(['SUPER_ADMIN'])).toBe(7);
  });

  it('returns the highest ceiling when multiple roles present', () => {
    expect(callerMaxLevel(['NURSE', 'HOSPITAL_ADMIN'])).toBe(6);
  });
});

// ── local filesystem mode ─────────────────────────────────────────────────────

describe('AuditLogsService (local filesystem)', () => {
  let service: AuditLogsService;

  beforeEach(async () => {
    delete process.env.MAYWIN_ARTIFACTS_BUCKET;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: S3ArtifactsService, useValue: mockS3 },
      ],
    }).compile();

    service = module.get(AuditLogsService);
  });

  describe('append', () => {
    it('writes a CSV line to the org-scoped local file', async () => {
      const entry = await service.append({
        orgId: '42',
        actorId: 'u1',
        actorName: 'Bob',
        action: 'CREATE_STAFF',
        targetType: 'staff',
        targetId: 'EMP001',
        detail: 'Created nurse Bob',
        level: 3,
      });

      expect(fsp.appendFile).toHaveBeenCalledTimes(1);
      const [filePath, content] = (fsp.appendFile as jest.Mock).mock.calls[0];
      expect(filePath).toContain('42');
      expect(filePath).toContain('audit-logs.csv');
      expect(content).toContain('CREATE_STAFF');
      expect(content).toContain('Bob');
      expect(entry.action).toBe('CREATE_STAFF');
      expect(entry.level).toBe(3);
    });

    it('clamps level to valid range', async () => {
      const entry = await service.append({
        orgId: '1',
        actorId: 'u1',
        actorName: 'Alice',
        action: 'TEST',
        targetType: '',
        targetId: '',
        detail: '',
        level: 99 as any,
      });
      expect(entry.level).toBe(7);
    });

    it('defaults level to 6 (informational) when omitted', async () => {
      const entry = await service.append({
        orgId: '1',
        actorId: 'u1',
        actorName: 'Alice',
        action: 'TEST',
        targetType: '',
        targetId: '',
        detail: '',
      });
      expect(entry.level).toBe(6);
    });

    it('never touches S3 when bucket is not configured', async () => {
      await service.append({
        orgId: '1',
        actorId: 'u1',
        actorName: 'Alice',
        action: 'TEST',
        targetType: '',
        targetId: '',
        detail: '',
      });
      expect(mockS3.getText).not.toHaveBeenCalled();
      expect(mockS3.putText).not.toHaveBeenCalled();
    });
  });

  describe('listNewestFirst', () => {
    it('returns entries newest first', async () => {
      const older = makeRow({ timestamp: '2025-01-01T00:00:00.000Z', level: '2' });
      const newer = makeRow({ timestamp: '2025-06-01T00:00:00.000Z', level: '2' });
      (fsp.readFile as jest.Mock).mockResolvedValue(makeCsv(older, newer));

      const { entries } = await service.listNewestFirst('1', ['NURSE']);
      expect(entries[0].timestamp).toBe('2025-06-01T00:00:00.000Z');
      expect(entries[1].timestamp).toBe('2025-01-01T00:00:00.000Z');
    });

    it('filters out entries above the caller role ceiling', async () => {
      const visible = makeRow({ action: 'VISIBLE', level: '5' }); // notice — within NURSE ceiling (5)
      const hidden = makeRow({ action: 'HIDDEN', level: '6' });   // informational — above NURSE ceiling
      (fsp.readFile as jest.Mock).mockResolvedValue(makeCsv(visible, hidden));

      const { entries } = await service.listNewestFirst('1', ['NURSE']);
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('VISIBLE');
    });

    it('reads from the correct org-scoped file path', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue(makeCsv());
      await service.listNewestFirst('99', ['SUPER_ADMIN']);

      const readPath = (fsp.readFile as jest.Mock).mock.calls[0][0] as string;
      expect(readPath).toContain('99');
      expect(readPath).toContain('audit-logs.csv');
    });

    it('includes maxLevel in the result', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue(makeCsv());
      const { maxLevel } = await service.listNewestFirst('1', ['HOSPITAL_ADMIN']);
      expect(maxLevel).toBe(6);
    });

    it('handles legacy string level values', async () => {
      const row = makeRow({ action: 'OLD_ACTION', level: 'INFO' });
      (fsp.readFile as jest.Mock).mockResolvedValue(makeCsv(row));

      const { entries } = await service.listNewestFirst('1', ['SUPER_ADMIN']);
      expect(entries[0].level).toBe(6); // INFO → informational (6) in RFC 5424
    });
  });
});

// ── S3 mode ───────────────────────────────────────────────────────────────────

describe('AuditLogsService (S3)', () => {
  let service: AuditLogsService;

  beforeEach(async () => {
    process.env.MAYWIN_ARTIFACTS_BUCKET = 'test-bucket';
    jest.clearAllMocks();
    mockS3.getText.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: S3ArtifactsService, useValue: mockS3 },
      ],
    }).compile();

    service = module.get(AuditLogsService);
  });

  afterEach(() => {
    delete process.env.MAYWIN_ARTIFACTS_BUCKET;
  });

  it('reads from and writes to the org-scoped S3 key', async () => {
    await service.append({
      orgId: '7',
      actorId: 'u1',
      actorName: 'Alice',
      action: 'CREATE_STAFF',
      targetType: 'staff',
      targetId: 'EMP001',
      detail: 'detail',
    });

    expect(mockS3.getText).toHaveBeenCalledWith(['logs', '7', 'audit-logs.csv']);
    expect(mockS3.putText).toHaveBeenCalledWith(
      ['logs', '7', 'audit-logs.csv'],
      expect.stringContaining('CREATE_STAFF'),
      'text/csv; charset=utf-8',
    );
  });

  it('different orgs write to different S3 keys', async () => {
    await service.append({ orgId: 'org-a', actorId: 'u1', actorName: 'A', action: 'ACT', targetType: '', targetId: '', detail: '' });
    await service.append({ orgId: 'org-b', actorId: 'u2', actorName: 'B', action: 'ACT', targetType: '', targetId: '', detail: '' });

    const keys = (mockS3.putText as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(keys[0]).toEqual(['logs', 'org-a', 'audit-logs.csv']);
    expect(keys[1]).toEqual(['logs', 'org-b', 'audit-logs.csv']);
  });

  it('appends to existing S3 content rather than overwriting it', async () => {
    const existing = makeCsv(makeRow({ action: 'OLD' }));
    mockS3.getText.mockResolvedValue(existing);

    await service.append({ orgId: '1', actorId: 'u1', actorName: 'A', action: 'NEW', targetType: '', targetId: '', detail: '' });

    const written: string = (mockS3.putText as jest.Mock).mock.calls[0][1];
    expect(written).toContain('OLD');
    expect(written).toContain('NEW');
  });

  it('never touches local filesystem when S3 is configured', async () => {
    await service.append({ orgId: '1', actorId: 'u1', actorName: 'A', action: 'ACT', targetType: '', targetId: '', detail: '' });
    expect(fsp.appendFile).not.toHaveBeenCalled();
  });
});
