// src/core/organizations/schedule-containers.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { ScheduleContainersService } from './schedule-containers.service';
import { Schedule, ScheduleStatus } from '@/database/entities/scheduling/schedule.entity';

const mockSchedule = (overrides: Partial<Schedule> = {}): Schedule =>
  ({
    id: 'sched-1',
    organization_id: '1',
    unit_id: null,
    name: 'May 2025',
    start_date: '2025-05-01',
    end_date: '2025-05-31',
    status: ScheduleStatus.DRAFT,
    notes: null,
    constraint_profile_id: null,
    job_id: null,
    last_solver_run_id: null,
    current_run_id: null,
    created_by: '42',
    published_at: null,
    published_by: null,
    attributes: { site: 'Main Campus', dept: 'ICU' },
    created_at: new Date('2025-01-01'),
    ...overrides,
  }) as unknown as Schedule;

type MockRepo = Partial<Record<keyof Repository<Schedule>, jest.Mock>>;

const createMockRepo = (): MockRepo => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

describe('ScheduleContainersService', () => {
  let service: ScheduleContainersService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleContainersService,
        { provide: getRepositoryToken(Schedule), useValue: repo },
      ],
    }).compile();

    service = module.get<ScheduleContainersService>(ScheduleContainersService);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns all containers for an org', async () => {
      repo.find!.mockResolvedValue([mockSchedule()]);
      const result = await service.list('1');
      expect(result.containers).toHaveLength(1);
      expect(result.containers[0].id).toBe('sched-1');
    });

    it('maps status DRAFT → draft', async () => {
      repo.find!.mockResolvedValue([mockSchedule({ status: ScheduleStatus.DRAFT })]);
      const { containers } = await service.list('1');
      expect(containers[0].status).toBe('draft');
    });

    it('maps status PUBLISHED → active', async () => {
      repo.find!.mockResolvedValue([mockSchedule({ status: ScheduleStatus.PUBLISHED })]);
      const { containers } = await service.list('1');
      expect(containers[0].status).toBe('active');
    });

    it('maps status ARCHIVED → archived', async () => {
      repo.find!.mockResolvedValue([mockSchedule({ status: ScheduleStatus.ARCHIVED })]);
      const { containers } = await service.list('1');
      expect(containers[0].status).toBe('archived');
    });

    it('maps attributes.site and attributes.dept', async () => {
      repo.find!.mockResolvedValue([mockSchedule()]);
      const { containers } = await service.list('1');
      expect(containers[0].site).toBe('Main Campus');
      expect(containers[0].dept).toBe('ICU');
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a container and returns it', async () => {
      const s = mockSchedule();
      repo.create!.mockReturnValue(s);
      repo.save!.mockResolvedValue(s);

      const result = await service.create('1', { name: 'May 2025', start: '2025-05-01', end: '2025-05-31' }, '42');
      expect(result.container.id).toBe('sched-1');
      expect(result.container.name).toBe('May 2025');
    });

    it('maps status "active" → PUBLISHED on create', async () => {
      const s = mockSchedule({ status: ScheduleStatus.PUBLISHED });
      repo.create!.mockReturnValue(s);
      repo.save!.mockResolvedValue(s);

      const result = await service.create('1', { name: 'Q2', start: '2025-04-01', end: '2025-06-30', status: 'active' }, '42');
      expect(result.container.status).toBe('active');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates fields and returns container', async () => {
      const s = mockSchedule();
      repo.findOne!.mockResolvedValue(s);
      repo.save!.mockResolvedValue({ ...s, name: 'Updated Name' });

      const result = await service.update('1', 'sched-1', { name: 'Updated Name' });
      expect(result.container.name).toBe('Updated Name');
    });

    it('throws NotFoundException when container missing', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.update('1', 'missing-id', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('updates site and dept in attributes', async () => {
      const s = mockSchedule();
      repo.findOne!.mockResolvedValue(s);
      repo.save!.mockResolvedValue({ ...s, attributes: { site: 'New Site', dept: 'Surgery' } });

      const result = await service.update('1', 'sched-1', { site: 'New Site', dept: 'Surgery' });
      expect(result.container.site).toBe('New Site');
      expect(result.container.dept).toBe('Surgery');
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('removes the container and returns ok', async () => {
      repo.findOne!.mockResolvedValue(mockSchedule());
      repo.remove!.mockResolvedValue(undefined);

      const result = await service.delete('1', 'sched-1');
      expect(result.ok).toBe(true);
    });

    it('throws NotFoundException when container missing', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.delete('1', 'missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
