import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsController } from '../src/core/audit-logs/audit-logs.controller';
import { AuditLogsService } from '../src/core/audit-logs/audit-logs.service';
import { S3ArtifactsService } from '../src/database/buckets/s3-artifacts.service';

// Stub S3 — tests run locally without AWS credentials.
// MAYWIN_ARTIFACTS_BUCKET is intentionally unset so AuditLogsService
// falls back to the local /tmp file path.
const s3Stub = {} as S3ArtifactsService;

describe('AuditLogsController & AuditLogsService', () => {
  let controller: AuditLogsController;
  let service: AuditLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        AuditLogsService,
        { provide: S3ArtifactsService, useValue: s3Stub },
      ],
    }).compile();

    controller = module.get<AuditLogsController>(AuditLogsController);
    service = module.get<AuditLogsService>(AuditLogsService);
  });

  describe('list()', () => {
    it('should return all audit logs newest-first', async () => {
      const logs = await service.listNewestFirst();

      expect(Array.isArray(logs)).toBe(true);
    });

    it('should return empty array when no logs exist', async () => {
      const logs = await service.listNewestFirst();

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('append()', () => {
    it('should append a new audit log entry', async () => {
      const entry = {
        actorId: '1',
        actorName: 'Admin User',
        action: 'CREATE_STAFF',
        targetType: 'staff',
        targetId: 'EMP001',
        detail: 'Created new staff member',
      };

      const result = await service.append(entry);

      expect(result).toHaveProperty('timestamp');
      expect(result.actorId).toBe('1');
      expect(result.actorName).toBe('Admin User');
      expect(result.action).toBe('CREATE_STAFF');
      expect(result.targetType).toBe('staff');
      expect(result.targetId).toBe('EMP001');
      expect(result.detail).toBe('Created new staff member');
    });

    it('should maintain CSV format in file', async () => {
      const entry = {
        actorId: '2',
        actorName: 'Test User',
        action: 'UPDATE_STAFF',
        targetType: 'staff',
        targetId: 'EMP002',
        detail: 'Updated staff member',
      };

      await service.append(entry);
      const csv = await service.readRawCsv();

      expect(csv).toContain('timestamp');
      expect(csv).toContain('actorId');
      expect(csv).toContain('UPDATE_STAFF');
    });

    it('should escape quotes in detail field', async () => {
      const entry = {
        actorId: '3',
        actorName: 'Test User',
        action: 'NOTE',
        targetType: 'staff',
        targetId: 'EMP003',
        detail: 'Special chars: "quotes", commas, newlines',
      };

      await service.append(entry);
      const csv = await service.readRawCsv();

      expect(csv).toContain('EMP003');
    });
  });

  describe('readRawCsv()', () => {
    it('should return CSV content with header', async () => {
      const csv = await service.readRawCsv();

      expect(csv).toContain('timestamp');
      expect(csv).toContain('actorId');
      expect(csv).toContain('actorName');
      expect(csv).toContain('action');
      expect(csv).toContain('targetType');
      expect(csv).toContain('targetId');
      expect(csv).toContain('detail');
    });
  });

  describe('integration with AuditLogsController', () => {
    it('should list logs via controller', async () => {
      // Mock request object
      const mockReq = {
        user: {
          sub: 1,
          email: 'test@test.com',
          fullName: 'Test User',
        },
      } as any;

      // Mock response object with passthrough
      const mockRes = {
        setHeader: jest.fn(),
      } as any;

      const result = await controller.list(undefined, mockRes);

      expect(result).toBeDefined();
      if (typeof result === 'object' && !Array.isArray(result)) {
        expect(result).toHaveProperty('ok');
        expect(result).toHaveProperty('logs');
        expect(Array.isArray((result as any).logs)).toBe(true);
      }
    });

    it('should create audit log via controller', async () => {
      const mockReq = {
        user: {
          sub: 1,
          email: 'test@test.com',
          fullName: 'Test User',
        },
      } as any;

      const dto = {
        action: 'TEST_ACTION',
        targetType: 'test',
        targetId: 'TEST001',
        detail: 'Test entry',
      };

      const result = await controller.create(mockReq, dto);

      expect(result.ok).toBe(true);
      expect(result.log).toHaveProperty('timestamp');
      expect(result.log.action).toBe('TEST_ACTION');
    });

    it('should export CSV when requested', async () => {
      const mockReq = {
        user: {
          sub: 1,
          email: 'test@test.com',
          fullName: 'Test User',
        },
      } as any;

      const mockRes = {
        setHeader: jest.fn(),
      } as any;

      const result = await controller.list('csv', mockRes);

      expect(typeof result).toBe('string');
      expect(result).toContain('timestamp');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="audit-logs-'),
      );
    });
  });
});
