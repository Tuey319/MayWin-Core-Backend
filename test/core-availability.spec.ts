import { AvailabilityController } from '../src/core/availability/availability.controller';
import { AvailabilityService } from '../src/core/availability/availability.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAvailRow(overrides: Partial<any> = {}) {
  return {
    id: 'av1',
    worker_id: '5',
    unit_id: '20',
    date: '2026-04-01',
    shift_code: 'MORNING',
    type: 'AVAILABLE',
    source: 'HEAD_NURSE_UI',
    reason: null,
    attributes: {},
    ...overrides,
  };
}

function makeCache() {
  return { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
}

function makeSvc(repoOverrides: Partial<any> = {}) {
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...repoOverrides,
  };
  const cache = makeCache();
  const auditLogs = { append: jest.fn().mockResolvedValue({}) };
  const svc = new AvailabilityService(repo as any, cache as any, auditLogs as any);
  return { svc, repo, cache };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('AvailabilityController', () => {
  it('should be defined', () => {
    const controller = new AvailabilityController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── AvailabilityService ────────────────────────────────────────────────────────

describe('AvailabilityService', () => {
  it('should be defined', () => {
    const svc = new AvailabilityService({} as any, {} as any, {} as any);
    expect(svc).toBeDefined();
  });

  // ── GET /units/:unitId/availability ──────────────────────────────────────────

  describe('get()', () => {
    it('returns availability entries for a unit and date range', async () => {
      const rows = [makeAvailRow(), makeAvailRow({ id: 'av2', date: '2026-04-02' })];
      const { svc, repo } = makeSvc({ find: jest.fn().mockResolvedValue(rows) });

      const result = await svc.get('20', '2026-04-01', '2026-04-30');

      expect(result.unitId).toBe('20');
      expect(result.availability).toHaveLength(2);
      expect(result.availability[0].workerId).toBe('5');
      expect(result.availability[0].type).toBe('AVAILABLE');
    });

    it('returns empty availability when no records exist', async () => {
      const { svc, repo } = makeSvc({ find: jest.fn().mockResolvedValue([]) });

      const result = await svc.get('20', '2026-04-01', '2026-04-30');

      expect(result.availability).toHaveLength(0);
    });

    it('returns cached result on second call', async () => {
      const cached = { unitId: '20', availability: [] };
      const { svc, cache } = makeSvc();
      cache.get.mockResolvedValue(cached);

      const result = await svc.get('20', '2026-04-01', '2026-04-30');

      expect(result).toBe(cached);
    });
  });

  // ── PUT /units/:unitId/availability ──────────────────────────────────────────

  describe('upsert()', () => {
    it('inserts new availability entries and returns updatedCount', async () => {
      const created = makeAvailRow();
      const { svc, repo } = makeSvc({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(created),
        save: jest.fn().mockResolvedValue(created),
      });

      const entries = [
        { workerId: '5', date: '2026-04-01', shiftCode: 'MORNING', type: 'AVAILABLE' as any },
        { workerId: '6', date: '2026-04-02', shiftCode: 'NIGHT', type: 'UNAVAILABLE' as any },
      ];

      const result = await svc.upsert('20', entries);

      expect(result.unitId).toBe('20');
      expect(result.updatedCount).toBe(2);
    });

    it('updates existing availability entries', async () => {
      const existing = makeAvailRow({ type: 'AVAILABLE' });
      const { svc, repo } = makeSvc({
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn().mockResolvedValue({ ...existing, type: 'UNAVAILABLE' }),
      });

      const entries = [
        { workerId: '5', date: '2026-04-01', shiftCode: 'MORNING', type: 'UNAVAILABLE' as any },
      ];

      const result = await svc.upsert('20', entries);

      expect(result.updatedCount).toBe(1);
      expect(repo.save).toHaveBeenCalled();
    });

    it('returns updatedCount: 0 for empty entries', async () => {
      const { svc } = makeSvc();

      const result = await svc.upsert('20', []);

      expect(result.updatedCount).toBe(0);
    });

    it('invalidates cache for the affected date range', async () => {
      const created = makeAvailRow();
      const { svc, repo, cache } = makeSvc({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(created),
        save: jest.fn().mockResolvedValue(created),
      });

      await svc.upsert('20', [
        { workerId: '5', date: '2026-04-01', shiftCode: 'MORNING', type: 'AVAILABLE' as any },
      ]);

      expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('availability:20'));
    });
  });
});
