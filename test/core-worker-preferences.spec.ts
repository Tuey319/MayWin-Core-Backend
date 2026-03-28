import { NotFoundException } from '@nestjs/common';
import { WorkerPreferencesController } from '../src/core/worker-preferences/worker-preferences.controller';
import { WorkerPreferencesService } from '../src/core/worker-preferences/worker-preferences.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWorker(overrides: Partial<any> = {}) {
  return {
    id: '5',
    full_name: 'Jane Nurse',
    worker_code: 'N001',
    is_active: true,
    primary_unit_id: '20',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makePrefs(overrides: Partial<any> = {}) {
  return {
    id: 'pref1',
    worker_id: 5,
    preference_pattern_json: {
      '2026-04-01': { shift: 'MORNING' },
      '2026-04-02': { shift: 'NIGHT' },
    },
    days_off_pattern_json: {},
    updated_at: new Date('2026-03-01'),
    ...overrides,
  };
}

function makeCache() {
  return { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
}

function makeSvc(workerOverrides: Partial<any> = {}, prefsOverrides: Partial<any> = {}) {
  const workersRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn(), ...workerOverrides };
  const membershipRepo = { find: jest.fn().mockResolvedValue([]) };
  const preferencesRepo = {
    findOne: jest.fn(), find: jest.fn(), save: jest.fn(), delete: jest.fn(), create: jest.fn(), ...prefsOverrides,
  };
  const workerAvailabilityRepo = { find: jest.fn().mockResolvedValue([]), delete: jest.fn() };
  const cache = makeCache();

  const svc = new WorkerPreferencesService(
    workersRepo as any, membershipRepo as any, preferencesRepo as any,
    workerAvailabilityRepo as any, cache as any,
  );
  return { svc, workersRepo, preferencesRepo, workerAvailabilityRepo, cache };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('WorkerPreferencesController', () => {
  it('should be defined', () => {
    const controller = new WorkerPreferencesController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── WorkerPreferencesService ───────────────────────────────────────────────────

describe('WorkerPreferencesService', () => {
  it('should be defined', () => {
    const svc = new WorkerPreferencesService(
      {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    expect(svc).toBeDefined();
  });

  // ── GET /workers/:workerId/preferences ────────────────────────────────────────

  describe('getPreferences()', () => {
    it('returns worker preferences', async () => {
      const worker = makeWorker();
      const prefs = makePrefs();
      const { svc } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        { findOne: jest.fn().mockResolvedValue(prefs) },
      );

      const result = await svc.getPreferences('5');

      expect(result.workerId).toBe('5');
      expect(result.preferences).toBeDefined();
    });

    it('returns null preferences when none exist', async () => {
      const worker = makeWorker();
      const { svc } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        { findOne: jest.fn().mockResolvedValue(null) },
      );

      const result = await svc.getPreferences('5');

      expect(result.preferences).toBeNull();
    });

    it('throws NotFoundException when worker does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.getPreferences('999')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when worker is inactive', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(makeWorker({ is_active: false })) });

      await expect(svc.getPreferences('5')).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /workers/:workerId/preferences ─────────────────────────────────────

  describe('deletePreferences()', () => {
    it('deletes all preferences for a worker', async () => {
      const worker = makeWorker();
      const prefs = makePrefs();
      const { svc, preferencesRepo } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        {
          findOne: jest.fn().mockResolvedValue(prefs),
          delete: jest.fn().mockResolvedValue(undefined),
        },
      );

      const result = await svc.deletePreferences('5');

      expect(preferencesRepo.delete).toHaveBeenCalled();
      expect(result).toEqual({ workerId: '5', deleted: true });
    });

    it('invalidates the unit cache', async () => {
      const worker = makeWorker({ primary_unit_id: '20' });
      const prefs = makePrefs();
      const { svc, cache } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        {
          findOne: jest.fn().mockResolvedValue(prefs),
          delete: jest.fn().mockResolvedValue(undefined),
        },
      );

      await svc.deletePreferences('5');

      expect(cache.del).toHaveBeenCalledWith('worker-prefs:list:20');
    });

    it('throws NotFoundException when worker does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.deletePreferences('999')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no preferences found for worker', async () => {
      const worker = makeWorker();
      const { svc } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        { findOne: jest.fn().mockResolvedValue(null) },
      );

      await expect(svc.deletePreferences('5')).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /workers/:workerId/preferences/requests/:date ─────────────────────

  describe('deletePreferenceRequest()', () => {
    it('deletes a preference request for a specific date and returns remaining count', async () => {
      const worker = makeWorker();
      const prefs = makePrefs();
      const { svc, preferencesRepo } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        {
          findOne: jest.fn().mockResolvedValue(prefs),
          save: jest.fn().mockResolvedValue({ ...prefs, preference_pattern_json: { '2026-04-02': { shift: 'NIGHT' } } }),
        },
      );

      const result = await svc.deletePreferenceRequest('5', '2026-04-01');

      expect(preferencesRepo.save).toHaveBeenCalled();
      expect(result.workerId).toBe('5');
      expect(result.deletedDate).toBe('2026-04-01');
      expect(result.remaining).toBe(1);
    });

    it('invalidates unit cache after deletion', async () => {
      const worker = makeWorker({ primary_unit_id: '20' });
      const prefs = makePrefs();
      const { svc, cache } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        {
          findOne: jest.fn().mockResolvedValue(prefs),
          save: jest.fn().mockResolvedValue(prefs),
        },
      );

      await svc.deletePreferenceRequest('5', '2026-04-01');

      expect(cache.del).toHaveBeenCalledWith('worker-prefs:list:20');
    });

    it('returns remaining: 0 when all requests are deleted', async () => {
      const worker = makeWorker();
      const prefs = makePrefs({ preference_pattern_json: { '2026-04-01': { shift: 'MORNING' } } });
      const { svc } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        {
          findOne: jest.fn().mockResolvedValue(prefs),
          save: jest.fn().mockResolvedValue({ ...prefs, preference_pattern_json: {} }),
        },
      );

      const result = await svc.deletePreferenceRequest('5', '2026-04-01');

      expect(result.remaining).toBe(0);
    });

    it('throws NotFoundException (404) when worker does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.deletePreferenceRequest('999', '2026-04-01')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException (404) when worker is inactive', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(makeWorker({ is_active: false })) });

      await expect(svc.deletePreferenceRequest('5', '2026-04-01')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException (404) when worker has no preferences stored', async () => {
      const worker = makeWorker();
      const { svc } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        { findOne: jest.fn().mockResolvedValue(null) },
      );

      await expect(svc.deletePreferenceRequest('5', '2026-04-01')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException (404) when the specific date has no request', async () => {
      const worker = makeWorker();
      const prefs = makePrefs({ preference_pattern_json: { '2026-04-05': { shift: 'MORNING' } } });
      const { svc } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        { findOne: jest.fn().mockResolvedValue(prefs) },
      );

      await expect(svc.deletePreferenceRequest('5', '2026-04-01')).rejects.toThrow(NotFoundException);
    });

    it('does not call cache.del when worker has no primary_unit_id', async () => {
      const worker = makeWorker({ primary_unit_id: null });
      const prefs = makePrefs();
      const { svc, cache } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(worker) },
        {
          findOne: jest.fn().mockResolvedValue(prefs),
          save: jest.fn().mockResolvedValue(prefs),
        },
      );

      await svc.deletePreferenceRequest('5', '2026-04-01');

      expect(cache.del).not.toHaveBeenCalled();
    });
  });
});
