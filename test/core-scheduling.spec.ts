import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ScheduleAssignmentsController } from '../src/core/scheduling/schedule-assignments.controller';
import { SchedulesController } from '../src/core/scheduling/schedules.controller';
import { SchedulesService } from '../src/core/scheduling/schedules.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<any> = {}) {
  return {
    id: 'sched1',
    organization_id: '1',
    unit_id: '20',
    job_id: null,
    name: 'April 2026',
    start_date: '2026-04-01',
    end_date: '2026-04-30',
    status: 'DRAFT',
    constraint_profile_id: null,
    last_solver_run_id: null,
    current_run_id: null,
    created_by: '42',
    published_at: null,
    published_by: null,
    attributes: {},
    created_at: new Date('2026-03-01'),
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<any> = {}) {
  return {
    id: 'asgn1',
    schedule_id: 'sched1',
    schedule_run_id: null,
    worker_id: '5',
    date: '2026-04-01',
    shift_code: 'MORNING',
    shift_order: 0,
    is_overtime: false,
    source: 'MANUAL',
    attributes: {},
    created_at: new Date('2026-03-01'),
    updated_at: new Date('2026-03-01'),
    ...overrides,
  };
}

function makeCache() {
  return { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
}

function makeSvc(overrides: Partial<any> = {}) {
  const schedulesRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exist: jest.fn(),
    ...overrides.schedulesRepo,
  };
  const assignmentsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    ...overrides.assignmentsRepo,
  };
  const shiftTemplatesRepo = { find: jest.fn().mockResolvedValue([]), ...overrides.shiftTemplatesRepo };
  const unitsRepo = { findOne: jest.fn(), ...overrides.unitsRepo };
  const usersRepo = { exist: jest.fn(), findOne: jest.fn(), ...overrides.usersRepo };
  const cache = makeCache();

  const svc = new SchedulesService(
    schedulesRepo as any,
    assignmentsRepo as any,
    shiftTemplatesRepo as any,
    unitsRepo as any,
    usersRepo as any,
    cache as any,
  );
  return { svc, schedulesRepo, assignmentsRepo, shiftTemplatesRepo, unitsRepo, usersRepo, cache };
}

// ── Controller smoke tests ─────────────────────────────────────────────────────

describe('ScheduleAssignmentsController', () => {
  it('should be defined', () => {
    const controller = new ScheduleAssignmentsController({} as any);
    expect(controller).toBeDefined();
  });
});

describe('SchedulesController', () => {
  it('should be defined', () => {
    const controller = new SchedulesController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── SchedulesService ───────────────────────────────────────────────────────────

describe('SchedulesService', () => {
  it('should be defined', () => {
    const svc = new SchedulesService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    expect(svc).toBeDefined();
  });

  // ── POST /units/:unitId/schedules ─────────────────────────────────────────────

  describe('createSchedule()', () => {
    it('creates and returns a schedule', async () => {
      const schedule = makeSchedule();
      const { svc, schedulesRepo, unitsRepo, usersRepo, cache } = makeSvc();
      usersRepo.exist.mockResolvedValue(true);
      unitsRepo.findOne.mockResolvedValue({ id: '20', organization_id: '1' });
      schedulesRepo.create.mockReturnValue(schedule);
      schedulesRepo.save.mockResolvedValue(schedule);
      cache.del.mockResolvedValue(undefined);

      const dto = { name: 'April 2026', startDate: '2026-04-01', endDate: '2026-04-30' };
      const result = await svc.createSchedule('20', dto as any, '42');

      expect(schedulesRepo.save).toHaveBeenCalled();
      expect(result.schedule.name).toBe('April 2026');
      expect(result.schedule.unitId).toBe('20');
    });

    it('throws UnauthorizedException when createdBy is missing', async () => {
      const { svc } = makeSvc();
      await expect(
        svc.createSchedule('20', { name: 'X', startDate: '2026-04-01', endDate: '2026-04-30' } as any, null as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user id is not found in DB', async () => {
      const { svc, usersRepo } = makeSvc();
      usersRepo.exist.mockResolvedValue(false);

      await expect(
        svc.createSchedule('20', { name: 'X', startDate: '2026-04-01', endDate: '2026-04-30' } as any, '42'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when unit does not exist', async () => {
      const { svc, usersRepo, unitsRepo } = makeSvc();
      usersRepo.exist.mockResolvedValue(true);
      unitsRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.createSchedule('999', { name: 'X', startDate: '2026-04-01', endDate: '2026-04-30' } as any, '42'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when createdBy is not a numeric string', async () => {
      const { svc } = makeSvc();
      await expect(
        svc.createSchedule('20', { name: 'X', startDate: '2026-04-01', endDate: '2026-04-30' } as any, 'not-a-number'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── GET /units/:unitId/schedules/history ──────────────────────────────────────

  describe('getScheduleHistory()', () => {
    it('returns schedule history for a unit', async () => {
      const schedules = [makeSchedule(), makeSchedule({ id: 'sched2', name: 'March 2026' })];
      const { svc, schedulesRepo } = makeSvc();
      schedulesRepo.find.mockResolvedValue(schedules);

      const result = await svc.getScheduleHistory('20', 10);

      expect(result.unitId).toBe('20');
      expect(result.schedules).toHaveLength(2);
    });

    it('returns empty schedules array when no schedules exist', async () => {
      const { svc, schedulesRepo } = makeSvc();
      schedulesRepo.find.mockResolvedValue([]);

      const result = await svc.getScheduleHistory('20', 10);

      expect(result.schedules).toHaveLength(0);
    });

    it('returns cached result on second call', async () => {
      const cached = { unitId: '20', schedules: [] };
      const { svc, cache } = makeSvc();
      cache.get.mockResolvedValue(cached);

      const result = await svc.getScheduleHistory('20', 10);

      expect(result).toBe(cached);
    });
  });

  // ── GET /schedules/:scheduleId ────────────────────────────────────────────────

  describe('getScheduleById()', () => {
    it('returns schedule with assignments and shift templates', async () => {
      const schedule = makeSchedule();
      const assignments = [makeAssignment()];
      const { svc, schedulesRepo, assignmentsRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(schedule);
      assignmentsRepo.find.mockResolvedValue(assignments);

      const result = await svc.getScheduleById('sched1');

      expect(result.schedule.id).toBe('sched1');
      expect(result.assignments).toHaveLength(1);
    });

    it('throws NotFoundException when schedule does not exist', async () => {
      const { svc, schedulesRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(null);

      await expect(svc.getScheduleById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── PATCH /schedule-assignments/:assignmentId ─────────────────────────────────

  describe('patchAssignment()', () => {
    it('updates an assignment and returns updated shape', async () => {
      const assignment = makeAssignment();
      const updated = { ...assignment, shift_code: 'NIGHT', worker_id: '6', source: 'MANUAL' };
      const { svc, assignmentsRepo } = makeSvc();
      assignmentsRepo.findOne.mockResolvedValue(assignment);
      assignmentsRepo.save.mockResolvedValue(updated);

      const result = await svc.patchAssignment('asgn1', {
        workerId: '6',
        date: '2026-04-01',
        shiftCode: 'NIGHT',
      } as any);

      expect(result.assignment.shiftCode).toBe('NIGHT');
      expect(result.assignment.source).toBe('MANUAL');
    });

    it('throws NotFoundException when assignment does not exist', async () => {
      const { svc, assignmentsRepo } = makeSvc();
      assignmentsRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.patchAssignment('non-existent', { workerId: '5', date: '2026-04-01', shiftCode: 'MORNING' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /schedules/:scheduleId/export ─────────────────────────────────────────

  describe('exportSchedule()', () => {
    it('returns stub export response for existing schedule', async () => {
      const { svc, schedulesRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(makeSchedule());

      const result = await svc.exportSchedule('sched1', 'pdf');

      expect(result.scheduleId).toBe('sched1');
      expect(result.format).toBe('pdf');
    });

    it('throws NotFoundException when schedule does not exist', async () => {
      const { svc, schedulesRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(null);

      await expect(svc.exportSchedule('non-existent', 'xlsx')).rejects.toThrow(NotFoundException);
    });
  });
});
