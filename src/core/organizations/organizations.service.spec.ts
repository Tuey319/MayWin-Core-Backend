// src/core/organizations/organizations.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { OrganizationsService } from './organizations.service';
import { Organization } from '@/database/entities/core/organization.entity';

const mockOrg = (): Organization =>
  ({
    id: '1',
    name: 'Bangkok Hospital',
    code: 'BKK',
    timezone: 'Asia/Bangkok',
    attributes: {},
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
  }) as Organization;

type MockRepo = Partial<Record<keyof Repository<Organization>, jest.Mock>>;

const createMockRepo = (): MockRepo => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: getRepositoryToken(Organization), useValue: repo },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it("returns the caller's org wrapped in an array", async () => {
      repo.findOne!.mockResolvedValue(mockOrg());
      const result = await service.list(1);
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].id).toBe('1');
    });

    it('throws NotFoundException when org does not exist', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.list(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns a single organization by id', async () => {
      repo.findOne!.mockResolvedValue(mockOrg());
      const result = await service.getById('1', 1);
      expect(result.organization.id).toBe('1');
      expect(result.organization.name).toBe('Bangkok Hospital');
    });

    it('throws ForbiddenException for cross-org access', async () => {
      await expect(service.getById('2', 1)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when org does not exist', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.getById('1', 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMe ─────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it("returns the caller's org", async () => {
      repo.findOne!.mockResolvedValue(mockOrg());
      const result = await service.getMe(1);
      expect(result.organization.code).toBe('BKK');
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.getMe(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ── patch ─────────────────────────────────────────────────────────────────

  describe('patch', () => {
    it('updates allowed fields', async () => {
      const org = mockOrg();
      repo.findOne!.mockResolvedValue(org);
      repo.save!.mockResolvedValue({ ...org, name: 'New Name' });

      const result = await service.patch('1', 1, { name: 'New Name' });
      expect(result.organization.name).toBe('New Name');
    });

    it('throws ForbiddenException for cross-org patch', async () => {
      await expect(service.patch('2', 1, { name: 'x' })).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when org missing', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.patch('1', 1, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns a new organization', async () => {
      const org = mockOrg();
      repo.create!.mockReturnValue(org);
      repo.save!.mockResolvedValue(org);

      const result = await service.create({ name: 'Bangkok Hospital', code: 'BKK' });
      expect(result.organization.id).toBe('1');
    });
  });
});
