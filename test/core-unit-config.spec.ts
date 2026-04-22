import { ConflictException, NotFoundException } from '@nestjs/common';
import { UnitConfigController } from '../src/core/unit-config/unit-config.controller';
import { UnitConfigService } from '../src/core/unit-config/unit-config.service';
import { ConstraintProfilesController } from '../src/core/unit-config/constraint-profiles/constraint-profiles.controller';
import { ConstraintProfilesService } from '../src/core/unit-config/constraint-profiles/constraint-profiles.service';
import { CoverageRulesController } from '../src/core/unit-config/coverage-rules/coverage-rules.controller';
import { CoverageRulesService } from '../src/core/unit-config/coverage-rules/coverage-rules.service';
import { ShiftTemplatesController } from '../src/core/unit-config/shift-templates/shift-templates.controller';
import { ShiftTemplatesService } from '../src/core/unit-config/shift-templates/shift-templates.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<any> = {}) {
  return {
    id: 'cp1',
    unit_id: '20',
    org_id: null,
    name: 'Default Profile',
    description: null,
    assigned_to: null,
    color: 'primary',
    max_consecutive_work_days: null,
    max_consecutive_night_shifts: null,
    min_rest_hours_between_shifts: null,
    max_shifts_per_day: 1,
    min_days_off_per_week: 2,
    max_nights_per_week: 2,
    forbid_night_to_morning: true,
    forbid_morning_to_night_same_day: false,
    forbid_evening_to_night: true,
    guarantee_full_coverage: true,
    allow_emergency_overrides: true,
    allow_second_shift_same_day_in_emergency: true,
    ignore_availability_in_emergency: false,
    allow_night_cap_override_in_emergency: true,
    allow_rest_rule_override_in_emergency: true,
    goal_minimize_staff_cost: true,
    goal_maximize_preference_satisfaction: true,
    goal_balance_workload: false,
    goal_balance_night_workload: false,
    goal_reduce_undesirable_shifts: true,
    penalty_weight_json: null,
    fairness_weight_json: null,
    goal_priority_json: null,
    num_search_workers: 8,
    time_limit_sec: 20,
    attributes: {},
    is_active: true,
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeShiftTemplate(overrides: Partial<any> = {}) {
  return {
    id: 'st1',
    organization_id: '1',
    unit_id: '20',
    code: 'MORNING',
    name: 'Morning Shift',
    start_time: '07:00',
    end_time: '15:00',
    attributes: {},
    is_active: true,
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeCoverageRule(overrides: Partial<any> = {}) {
  return {
    id: 'cr1',
    unit_id: '20',
    shift_code: 'MORNING',
    day_type: 'WEEKDAY',
    min_workers: 3,
    max_workers: 5,
    required_tag: null,
    attributes: {},
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Controller smoke tests ─────────────────────────────────────────────────────

describe('UnitConfigController', () => {
  it('should be defined', () => {
    const controller = new UnitConfigController({} as any);
    expect(controller).toBeDefined();
  });
});

describe('UnitConfigService', () => {
  it('should be defined', () => {
    const svc = new UnitConfigService({} as any, {} as any, {} as any);
    expect(svc).toBeDefined();
  });
});

describe('ConstraintProfilesController', () => {
  it('should be defined', () => {
    const controller = new ConstraintProfilesController({} as any);
    expect(controller).toBeDefined();
  });
});

describe('CoverageRulesController', () => {
  it('should be defined', () => {
    const controller = new CoverageRulesController({} as any);
    expect(controller).toBeDefined();
  });
});

describe('ShiftTemplatesController', () => {
  it('should be defined', () => {
    const controller = new ShiftTemplatesController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── ConstraintProfilesService ──────────────────────────────────────────────────

describe('ConstraintProfilesService', () => {
  it('should be defined', () => {
    const svc = new ConstraintProfilesService({} as any);
    expect(svc).toBeDefined();
  });

  // ── POST /units/:unitId/constraint-profiles ────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a constraint profile', async () => {
      const profile = makeProfile();
      const repo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn().mockReturnValue(profile),
        save: jest.fn().mockResolvedValue(profile),
        remove: jest.fn(),
        createQueryBuilder: jest.fn(),
      };
      const svc = new ConstraintProfilesService(repo as any);

      const dto = { name: 'Default Profile', isActive: true } as any;
      const result = await svc.create('20', dto);

      expect(repo.save).toHaveBeenCalled();
      expect(result.profile.name).toBe('Default Profile');
    });
  });

  // ── GET /units/:unitId/constraint-profiles ─────────────────────────────────────

  describe('listByUnit()', () => {
    it('returns all profiles for a unit', async () => {
      const profiles = [makeProfile(), makeProfile({ id: 'cp2', name: 'Night Profile' })];
      const repo = {
        find: jest.fn().mockResolvedValue(profiles),
        create: jest.fn(), save: jest.fn(), remove: jest.fn(), findOne: jest.fn(),
      };
      const svc = new ConstraintProfilesService(repo as any);

      const result = await svc.listByUnit('20');

      expect(result.profiles).toHaveLength(2);
    });

    it('returns empty profiles array when none exist', async () => {
      const repo = { find: jest.fn().mockResolvedValue([]), create: jest.fn(), save: jest.fn(), remove: jest.fn(), findOne: jest.fn() };
      const svc = new ConstraintProfilesService(repo as any);

      const result = await svc.listByUnit('20');

      expect(result.profiles).toHaveLength(0);
    });
  });

  // ── PATCH /units/:unitId/constraint-profiles/:id ─────────────────────────────

  describe('update()', () => {
    it('updates and returns the constraint profile', async () => {
      const profile = makeProfile();
      const updated = makeProfile({ name: 'Updated Profile', max_shifts_per_day: 2 });
      const repo = {
        findOne: jest.fn().mockResolvedValue(profile),
        save: jest.fn().mockResolvedValue(updated),
        find: jest.fn(), create: jest.fn(), remove: jest.fn(),
      };
      const svc = new ConstraintProfilesService(repo as any);

      const result = await svc.update('20', 'cp1', { name: 'Updated Profile', maxShiftsPerDay: 2 });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'cp1', unit_id: '20' } });
      expect(repo.save).toHaveBeenCalled();
      expect(result.profile.name).toBe('Updated Profile');
    });

    it('throws NotFoundException when profile not found', async () => {
      const repo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn(), find: jest.fn(), create: jest.fn(), remove: jest.fn() };
      const svc = new ConstraintProfilesService(repo as any);

      await expect(svc.update('20', 'non-existent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when profile belongs to a different unit', async () => {
      const repo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn(), find: jest.fn(), create: jest.fn(), remove: jest.fn() };
      const svc = new ConstraintProfilesService(repo as any);

      await expect(svc.update('999', 'cp1', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('applies only provided fields', async () => {
      const profile = makeProfile({ name: 'Old Name', max_shifts_per_day: 1 });
      const repo = {
        findOne: jest.fn().mockResolvedValue(profile),
        save: jest.fn().mockImplementation((p: any) => Promise.resolve(p)),
        find: jest.fn(), create: jest.fn(), remove: jest.fn(),
      };
      const svc = new ConstraintProfilesService(repo as any);

      const result = await svc.update('20', 'cp1', { name: 'New Name' });

      expect(result.profile.name).toBe('New Name');
      expect(result.profile.maxShiftsPerDay).toBe(1);
    });

    it('can update boolean constraint flags', async () => {
      const profile = makeProfile({ forbid_night_to_morning: true });
      const saved = makeProfile({ forbid_night_to_morning: false });
      const repo = { findOne: jest.fn().mockResolvedValue(profile), save: jest.fn().mockResolvedValue(saved), find: jest.fn(), create: jest.fn(), remove: jest.fn() };
      const svc = new ConstraintProfilesService(repo as any);

      const result = await svc.update('20', 'cp1', { forbidNightToMorning: false });

      expect(result.profile.forbidNightToMorning).toBe(false);
    });

    it('can update goal settings', async () => {
      const profile = makeProfile({ goal_balance_workload: false });
      const saved = makeProfile({ goal_balance_workload: true });
      const repo = { findOne: jest.fn().mockResolvedValue(profile), save: jest.fn().mockResolvedValue(saved), find: jest.fn(), create: jest.fn(), remove: jest.fn() };
      const svc = new ConstraintProfilesService(repo as any);

      const result = await svc.update('20', 'cp1', { goalBalanceWorkload: true });

      expect(result.profile.goalBalanceWorkload).toBe(true);
    });
  });
});

// ── ShiftTemplatesService ──────────────────────────────────────────────────────

describe('ShiftTemplatesService', () => {
  it('should be defined', () => {
    const svc = new ShiftTemplatesService({} as any, {} as any);
    expect(svc).toBeDefined();
  });

  function makeRepo(overrides: Partial<any> = {}) {
    return { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), remove: jest.fn(), ...overrides };
  }

  // ── POST /units/:unitId/shift-templates ────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a shift template', async () => {
      const template = makeShiftTemplate();
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(template),
        save: jest.fn().mockResolvedValue(template),
      });
      const svc = new ShiftTemplatesService(repo as any, {} as any);

      const dto = { code: 'MORNING', name: 'Morning Shift', startTime: '07:00', endTime: '15:00' } as any;
      const result = await svc.create('1', '20', dto);

      expect(repo.save).toHaveBeenCalled();
      expect(result.code).toBe('MORNING');
      expect(result.isActive).toBe(true);
    });

    it('throws ConflictException when code already exists for the unit', async () => {
      const existing = makeShiftTemplate();
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(existing) });
      const svc = new ShiftTemplatesService(repo as any, {} as any);

      const dto = { code: 'MORNING', name: 'Duplicate', startTime: '07:00', endTime: '15:00' } as any;
      await expect(svc.create('1', '20', dto)).rejects.toThrow(ConflictException);
    });
  });

  // ── PATCH /units/:unitId/shift-templates/:id ────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the shift template', async () => {
      const template = makeShiftTemplate();
      const updated = makeShiftTemplate({ name: 'Early Morning' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(template),
        save: jest.fn().mockResolvedValue(updated),
      });
      const svc = new ShiftTemplatesService(repo as any, {} as any);

      const result = await svc.update('1', '20', 'st1', { name: 'Early Morning' } as any);

      expect(result.name).toBe('Early Morning');
    });

    it('throws NotFoundException when template not found', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new ShiftTemplatesService(repo as any, {} as any);

      await expect(svc.update('1', '20', 'non-existent', { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when updating to a duplicate code', async () => {
      const template = makeShiftTemplate({ code: 'MORNING' });
      const duplicate = makeShiftTemplate({ id: 'st2', code: 'EVENING' });
      const repo = makeRepo({
        findOne: jest.fn()
          .mockResolvedValueOnce(template)  // first call: find template to update
          .mockResolvedValueOnce(duplicate), // second call: check for duplicate code
      });
      const svc = new ShiftTemplatesService(repo as any, {} as any);

      await expect(svc.update('1', '20', 'st1', { code: 'EVENING' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ── DELETE /units/:unitId/shift-templates/:id ───────────────────────────────────

  describe('deactivate()', () => {
    it('sets is_active to false', async () => {
      const template = makeShiftTemplate({ is_active: true });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(template),
        save: jest.fn().mockResolvedValue({ ...template, is_active: false }),
      });
      const svc = new ShiftTemplatesService(repo as any, {} as any);

      const result = await svc.deactivate('1', '20', 'st1');

      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException when template not found', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new ShiftTemplatesService(repo as any, {} as any);

      await expect(svc.deactivate('1', '20', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

// ── CoverageRulesService ──────────────────────────────────────────────────────

describe('CoverageRulesService', () => {
  it('should be defined', () => {
    const svc = new CoverageRulesService({} as any);
    expect(svc).toBeDefined();
  });

  function makeRepo(overrides: Partial<any> = {}) {
    return { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), remove: jest.fn(), delete: jest.fn(), ...overrides };
  }

  // ── POST /units/:unitId/coverage-rules ────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a coverage rule', async () => {
      const rule = makeCoverageRule();
      const repo = makeRepo({
        create: jest.fn().mockReturnValue(rule),
        save: jest.fn().mockResolvedValue(rule),
      });
      const svc = new CoverageRulesService(repo as any);

      const dto = { shiftCode: 'MORNING', dayType: 'WEEKDAY', minWorkers: 3, maxWorkers: 5 } as any;
      const result = await svc.create('20', dto);

      expect(repo.save).toHaveBeenCalled();
      expect(result.shiftCode).toBe('MORNING');
      expect(result.minWorkers).toBe(3);
    });
  });

  // ── PATCH /units/:unitId/coverage-rules/:id ───────────────────────────────────

  describe('update()', () => {
    it('updates and returns the coverage rule', async () => {
      const rule = makeCoverageRule();
      const updated = makeCoverageRule({ min_workers: 4 });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(rule),
        save: jest.fn().mockResolvedValue(updated),
      });
      const svc = new CoverageRulesService(repo as any);

      const dto = { shiftCode: 'MORNING', dayType: 'WEEKDAY', minWorkers: 4, maxWorkers: 5 } as any;
      const result = await svc.update('20', 'cr1', dto);

      expect(result.minWorkers).toBe(4);
    });

    it('throws NotFoundException when rule not found', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new CoverageRulesService(repo as any);

      await expect(svc.update('20', 'non-existent', { shiftCode: 'X', dayType: 'WEEKDAY' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /units/:unitId/coverage-rules/:id ──────────────────────────────────

  describe('remove()', () => {
    it('removes the coverage rule and returns ok', async () => {
      const rule = makeCoverageRule();
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(rule),
        remove: jest.fn().mockResolvedValue(undefined),
      });
      const svc = new CoverageRulesService(repo as any);

      const result = await svc.remove('20', 'cr1');

      expect(repo.remove).toHaveBeenCalledWith(rule);
      expect(result).toEqual({ ok: true });
    });

    it('throws NotFoundException when rule not found', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new CoverageRulesService(repo as any);

      await expect(svc.remove('20', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /units/:unitId/coverage-rules (bulk replace) ─────────────────────────

  describe('replace()', () => {
    it('deletes old rules and inserts new ones', async () => {
      const rules = [makeCoverageRule(), makeCoverageRule({ id: 'cr2', shift_code: 'NIGHT' })];
      const repo = makeRepo({
        delete: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockReturnValue(rules),
        save: jest.fn().mockResolvedValue(rules),
      });
      const svc = new CoverageRulesService(repo as any);

      const dto = {
        items: [
          { shiftCode: 'MORNING', dayType: 'WEEKDAY', minWorkers: 3 },
          { shiftCode: 'NIGHT', dayType: 'WEEKDAY', minWorkers: 2 },
        ],
      } as any;
      const result = await svc.replace('20', dto);

      expect(repo.delete).toHaveBeenCalledWith({ unit_id: '20' });
      expect(result.unitId).toBe('20');
    });

    it('returns empty coverageRules when items is empty', async () => {
      const repo = makeRepo({ delete: jest.fn().mockResolvedValue(undefined) });
      const svc = new CoverageRulesService(repo as any);

      const result = await svc.replace('20', { items: [] } as any);

      expect(result.coverageRules).toHaveLength(0);
    });
  });
});
