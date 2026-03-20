// src/core/unit-config/constraint-profiles/constraint-profiles.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { ConstraintProfilesService } from './constraint-profiles.service';
import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';

const mockProfile = (overrides: Partial<ConstraintProfile> = {}): ConstraintProfile =>
  ({
    id: 'p-1',
    unit_id: null,
    org_id: '1',
    name: 'ICU Standard',
    description: 'Standard ICU shift rules',
    assigned_to: 'ICU',
    color: 'primary',
    constraints_json: [{ key: 'maxConsecutiveShifts', enabled: true, type: 'number', value: 3 }],
    goals_json: [{ key: 'fairWorkload', enabled: true, priority: 1 }],
    // solver fields (defaults)
    max_consecutive_work_days: null,
    max_consecutive_night_shifts: null,
    min_rest_hours_between_shifts: null,
    max_shifts_per_day: 1,
    min_days_off_per_week: 2,
    max_nights_per_week: 2,
    forbid_night_to_morning: true,
    forbid_morning_to_night_same_day: false,
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
    created_at: new Date('2025-01-01'),
    ...overrides,
  }) as unknown as ConstraintProfile;

type MockRepo = Partial<Record<keyof Repository<ConstraintProfile>, jest.Mock>>;

const createMockRepo = (): MockRepo => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ConstraintProfilesService — org-level methods', () => {
  let service: ConstraintProfilesService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConstraintProfilesService,
        { provide: getRepositoryToken(ConstraintProfile), useValue: repo },
      ],
    }).compile();

    service = module.get<ConstraintProfilesService>(ConstraintProfilesService);
  });

  // ── listByOrg ─────────────────────────────────────────────────────────────

  describe('listByOrg', () => {
    it('returns all profiles for an org', async () => {
      repo.find!.mockResolvedValue([mockProfile()]);
      const result = await service.listByOrg('1');
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].id).toBe('p-1');
      expect(result.profiles[0].name).toBe('ICU Standard');
    });

    it('returns empty array when no profiles', async () => {
      repo.find!.mockResolvedValue([]);
      const result = await service.listByOrg('1');
      expect(result.profiles).toHaveLength(0);
    });

    it('includes constraints and goals arrays in response', async () => {
      repo.find!.mockResolvedValue([mockProfile()]);
      const { profiles } = await service.listByOrg('1');
      expect(profiles[0].constraints).toHaveLength(1);
      expect(profiles[0].goals).toHaveLength(1);
    });
  });

  // ── createForOrg ──────────────────────────────────────────────────────────

  describe('createForOrg', () => {
    it('creates an org-level profile with name and color', async () => {
      const p = mockProfile();
      repo.create!.mockReturnValue(p);
      repo.save!.mockResolvedValue(p);

      const result = await service.createForOrg('1', {
        name: 'ICU Standard',
        description: 'Standard ICU shift rules',
        assignedTo: 'ICU',
        color: 'primary',
        constraints: [{ key: 'maxConsecutiveShifts', enabled: true }],
        goals: [{ key: 'fairWorkload', enabled: true }],
      });

      expect(result.profile.id).toBe('p-1');
      expect(result.profile.assignedTo).toBe('ICU');
    });

    it('defaults color to primary when not provided', async () => {
      const p = mockProfile({ color: 'primary' });
      repo.create!.mockReturnValue(p);
      repo.save!.mockResolvedValue(p);

      const result = await service.createForOrg('1', { name: 'Profile X' });
      expect(result.profile.color).toBe('primary');
    });
  });

  // ── updateForOrg ──────────────────────────────────────────────────────────

  describe('updateForOrg', () => {
    it('updates profile fields', async () => {
      const p = mockProfile();
      repo.findOne!.mockResolvedValue(p);
      repo.save!.mockResolvedValue({ ...p, name: 'Updated Name', color: 'warning' });

      const result = await service.updateForOrg('1', 'p-1', { name: 'Updated Name', color: 'warning' });
      expect(result.profile.name).toBe('Updated Name');
      expect(result.profile.color).toBe('warning');
    });

    it('throws NotFoundException when profile missing', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.updateForOrg('1', 'missing', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('preserves constraints and goals when not provided', async () => {
      const p = mockProfile();
      repo.findOne!.mockResolvedValue(p);
      repo.save!.mockResolvedValue(p);

      const result = await service.updateForOrg('1', 'p-1', { name: 'New Name' });
      expect(result.profile.constraints).toHaveLength(1);
      expect(result.profile.goals).toHaveLength(1);
    });
  });

  // ── deleteForOrg ──────────────────────────────────────────────────────────

  describe('deleteForOrg', () => {
    it('removes the profile and returns ok', async () => {
      repo.findOne!.mockResolvedValue(mockProfile());
      repo.remove!.mockResolvedValue(undefined);

      const result = await service.deleteForOrg('1', 'p-1');
      expect(result.ok).toBe(true);
    });

    it('throws NotFoundException when profile missing', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.deleteForOrg('1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
