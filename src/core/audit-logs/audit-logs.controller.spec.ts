import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuditLogEntry } from './audit-logs.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    timestamp: '2025-06-01T00:00:00.000Z',
    actorId: 'u1',
    actorName: 'Alice',
    action: 'CREATE_STAFF',
    targetType: 'staff',
    targetId: 'EMP001',
    detail: 'detail',
    level: 3,
    ...overrides,
  };
}

function makeReq(userOverrides: Record<string, any> = {}) {
  return {
    user: {
      sub: 'u1',
      fullName: 'Alice',
      organizationId: '42',
      roles: ['HEAD_NURSE'],
      ...userOverrides,
    },
  } as any;
}

// ── mock service ──────────────────────────────────────────────────────────────

const mockService = {
  listNewestFirst: jest.fn(),
  append: jest.fn(),
  readRawCsv: jest.fn(),
};

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AuditLogsController', () => {
  let controller: AuditLogsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [{ provide: AuditLogsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuditLogsController);
  });

  // ── GET /audit-logs ────────────────────────────────────────────────────────

  describe('GET /audit-logs', () => {
    it('returns logs scoped to the caller org', async () => {
      const entry = makeEntry();
      mockService.listNewestFirst.mockResolvedValue({ entries: [entry], maxLevel: 3 });
      const mockRes = { setHeader: jest.fn() } as any;

      const result = await controller.list(makeReq(), undefined, undefined, mockRes);

      expect(mockService.listNewestFirst).toHaveBeenCalledWith('42', ['HEAD_NURSE']);
      expect(result).toEqual({ ok: true, logs: [entry], maxLevel: 3 });
    });

    it('uses orgId query override when provided (SUPER_ADMIN querying another org)', async () => {
      mockService.listNewestFirst.mockResolvedValue({ entries: [], maxLevel: 6 });
      const mockRes = { setHeader: jest.fn() } as any;
      const req = makeReq({ organizationId: '1', roles: ['SUPER_ADMIN'] });

      await controller.list(req, undefined, '99', mockRes);

      expect(mockService.listNewestFirst).toHaveBeenCalledWith('99', ['SUPER_ADMIN']);
    });

    it('returns raw CSV when export=csv', async () => {
      const csv = 'timestamp,actorId\n2025-01-01,u1\n';
      mockService.readRawCsv.mockResolvedValue(csv);
      const mockRes = { setHeader: jest.fn() } as any;

      const result = await controller.list(makeReq(), 'csv', undefined, mockRes);

      expect(mockService.readRawCsv).toHaveBeenCalledWith('42');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(result).toBe(csv);
    });

    it('falls back to "unknown" orgId when JWT has no organizationId', async () => {
      mockService.listNewestFirst.mockResolvedValue({ entries: [], maxLevel: 2 });
      const mockRes = { setHeader: jest.fn() } as any;
      const req = makeReq({ organizationId: undefined });

      await controller.list(req, undefined, undefined, mockRes);

      expect(mockService.listNewestFirst).toHaveBeenCalledWith('unknown', expect.any(Array));
    });
  });

  // ── POST /audit-logs ───────────────────────────────────────────────────────

  describe('POST /audit-logs', () => {
    const dto = {
      action: 'CREATE_STAFF',
      targetType: 'staff',
      targetId: 'EMP001',
      detail: 'Created nurse',
      level: 3 as const,
    };

    it('appends a log scoped to the caller org', async () => {
      const entry = makeEntry();
      mockService.append.mockResolvedValue(entry);

      const result = await controller.create(makeReq(), dto);

      expect(mockService.append).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: '42', action: 'CREATE_STAFF' }),
      );
      expect(result).toEqual({ ok: true, log: entry });
    });

    it('takes actorId and actorName from the DTO when provided', async () => {
      mockService.append.mockResolvedValue(makeEntry());

      await controller.create(makeReq(), {
        ...dto,
        actorId: 'override-id',
        actorName: 'Override Name',
      });

      expect(mockService.append).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'override-id', actorName: 'Override Name' }),
      );
    });

    it('falls back to JWT user fields when DTO omits actorId/actorName', async () => {
      mockService.append.mockResolvedValue(makeEntry());

      await controller.create(makeReq({ sub: 'jwt-sub', fullName: 'JWT User' }), dto);

      expect(mockService.append).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'jwt-sub', actorName: 'JWT User' }),
      );
    });

    it('defaults level to 6 (informational) when DTO omits it', async () => {
      mockService.append.mockResolvedValue(makeEntry({ level: 6 }));
      const { level: _l, ...dtoNoLevel } = dto;

      await controller.create(makeReq(), dtoNoLevel as any);

      expect(mockService.append).toHaveBeenCalledWith(
        expect.objectContaining({ level: 6 }),
      );
    });
  });
});
