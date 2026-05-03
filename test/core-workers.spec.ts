import { NotFoundException } from '@nestjs/common';
import { WorkersController } from '../src/core/workers/workers.controller';
import { WorkersService } from '../src/core/workers/workers.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWorker(overrides: Partial<any> = {}) {
  return {
    id: '5',
    full_name: 'Jane Nurse',
    employment_type: 'FULL_TIME',
    primary_unit_id: '20',
    worker_code: 'N001',
    is_active: true,
    attributes: {},
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeCache() {
  return { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
}

function makeSvc(overrides: Partial<any> = {}) {
  const workersRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), ...overrides.workersRepo };
  const prefsRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), ...overrides.prefsRepo };
  const jobsRepo = {};
  const artifactsRepo = {};
  const schedulesRepo = {};
  const assignmentsRepo = {};
  const shiftTemplatesRepo = {};
  const s3Artifacts = {};
  const cache = makeCache();
  const auditLogs = { append: jest.fn().mockResolvedValue({}) };

  const svc = new WorkersService(
    workersRepo as any,
    prefsRepo as any,
    jobsRepo as any,
    artifactsRepo as any,
    schedulesRepo as any,
    assignmentsRepo as any,
    shiftTemplatesRepo as any,
    s3Artifacts as any,
    cache as any,
    auditLogs as any,
  );
  return { svc, workersRepo, prefsRepo, cache };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('WorkersController', () => {
  it('should be defined', () => {
    const controller = new WorkersController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── WorkersService ─────────────────────────────────────────────────────────────

describe('WorkersService', () => {
  it('should be defined', () => {
    const svc = new WorkersService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    expect(svc).toBeDefined();
  });

  // ── GET /units/:unitId/workers ────────────────────────────────────────────────

  describe('listWorkers()', () => {
    it('returns workers for a unit', async () => {
      const workers = [makeWorker(), makeWorker({ id: '6', full_name: 'Bob Nurse' })];
      const { svc, workersRepo, prefsRepo } = makeSvc();
      workersRepo.find.mockResolvedValue(workers);
      prefsRepo.find.mockResolvedValue([]);

      const result = await svc.listWorkers('20', null);

      expect(result.workers).toHaveLength(2);
      expect(result.workers[0].fullName).toBe('Jane Nurse');
    });

    it('returns empty workers array when unit has no active workers', async () => {
      const { svc, workersRepo } = makeSvc();
      workersRepo.find.mockResolvedValue([]);

      const result = await svc.listWorkers('20', null);

      expect(result.workers).toHaveLength(0);
    });

    it('returns cached result on second call', async () => {
      const cached = { workers: [{ id: '5', fullName: 'Cached Nurse' }] };
      const { svc, cache } = makeSvc();
      cache.get.mockResolvedValue(cached);

      const result = await svc.listWorkers('20', null);

      expect(result).toBe(cached);
    });

    it('maps averageSatisfaction from preferences attributes', async () => {
      const worker = makeWorker({ id: '5' });
      const pref = { worker_id: '5', attributes: { averageSatisfaction: 0.85 } };
      const { svc, workersRepo, prefsRepo } = makeSvc();
      workersRepo.find.mockResolvedValue([worker]);
      prefsRepo.find.mockResolvedValue([pref]);

      const result = await svc.listWorkers('20', null);

      expect(result.workers[0].averageSatisfaction).toBe(0.85);
    });

    it('sets averageSatisfaction to null when no preferences exist', async () => {
      const worker = makeWorker({ id: '5' });
      const { svc, workersRepo, prefsRepo } = makeSvc();
      workersRepo.find.mockResolvedValue([worker]);
      prefsRepo.find.mockResolvedValue([]);

      const result = await svc.listWorkers('20', null);

      expect(result.workers[0].averageSatisfaction).toBeNull();
    });
  });

  // ── PUT /workers/:workerId/preferences ────────────────────────────────────────

  describe('upsertPreferences()', () => {
    it('creates new preferences when none exist', async () => {
      const worker = makeWorker();
      const savedPref = { worker_id: '5', prefers_day_shifts: true, attributes: {} };
      const { svc, workersRepo, prefsRepo, cache } = makeSvc();
      workersRepo.findOne.mockResolvedValue(worker);
      prefsRepo.findOne.mockResolvedValue(null);
      prefsRepo.create.mockReturnValue(savedPref);
      prefsRepo.save.mockResolvedValue(savedPref);

      const dto = { prefersDayShifts: true } as any;
      await svc.upsertPreferences('5', dto);

      expect(prefsRepo.save).toHaveBeenCalled();
    });

    it('updates existing preferences', async () => {
      const worker = makeWorker();
      const existing = { worker_id: '5', prefers_day_shifts: false, attributes: {} };
      const updated = { ...existing, prefers_day_shifts: true };
      const { svc, workersRepo, prefsRepo } = makeSvc();
      workersRepo.findOne.mockResolvedValue(worker);
      prefsRepo.findOne.mockResolvedValue(existing);
      prefsRepo.save.mockResolvedValue(updated);

      await svc.upsertPreferences('5', { prefersDayShifts: true } as any);

      expect(prefsRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when worker does not exist', async () => {
      const { svc, workersRepo } = makeSvc();
      workersRepo.findOne.mockResolvedValue(null);

      await expect(svc.upsertPreferences('999', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('invalidates the worker list cache after upsert', async () => {
      const worker = makeWorker({ primary_unit_id: '20' });
      const savedPref = { worker_id: '5', attributes: {} };
      const { svc, workersRepo, prefsRepo, cache } = makeSvc();
      workersRepo.findOne.mockResolvedValue(worker);
      prefsRepo.findOne.mockResolvedValue(null);
      prefsRepo.create.mockReturnValue(savedPref);
      prefsRepo.save.mockResolvedValue(savedPref);

      await svc.upsertPreferences('5', {} as any);

      expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('workers:list'));
    });
  });
});
