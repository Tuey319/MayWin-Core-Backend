import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationsController } from '../src/core/organizations/organizations.controller';
import { OrganizationsService } from '../src/core/organizations/organizations.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeOrg(overrides: Partial<any> = {}) {
  return {
    id: '1',
    name: 'Test Org',
    code: 'TEST',
    timezone: 'Asia/Bangkok',
    attributes: {},
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('OrganizationsController', () => {
  it('should be defined', () => {
    const controller = new OrganizationsController({} as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });
});

// ── OrganizationsService ───────────────────────────────────────────────────────

describe('OrganizationsService', () => {
  it('should be defined', () => {
    const svc = new OrganizationsService({} as any);
    expect(svc).toBeDefined();
  });

  // ── GET /organizations ───────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns all orgs for ADMIN', async () => {
      const orgs = [makeOrg({ id: '1' }), makeOrg({ id: '2' })];
      const repo = makeRepo({ find: jest.fn().mockResolvedValue(orgs) });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.list(1, ['ADMIN']);

      expect(repo.find).toHaveBeenCalled();
      expect(result.organizations).toHaveLength(2);
    });

    it('returns only own org for non-admin', async () => {
      const org = makeOrg();
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(org) });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.list(1, ['NURSE']);

      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].id).toBe('1');
    });

    it('throws NotFoundException when own org does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new OrganizationsService(repo as any);

      await expect(svc.list(1, ['NURSE'])).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /organizations/:orgId ────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns organization by id for matching org user', async () => {
      const org = makeOrg();
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(org) });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.getById('1', 1);

      expect(result.organization.id).toBe('1');
    });

    it('allows ADMIN to get any org', async () => {
      const org = makeOrg({ id: '99' });
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(org) });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.getById('99', 1, ['ADMIN']);

      expect(result.organization.id).toBe('99');
    });

    it('throws ForbiddenException for org mismatch', async () => {
      const repo = makeRepo();
      const svc = new OrganizationsService(repo as any);

      await expect(svc.getById('2', 1)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when org does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new OrganizationsService(repo as any);

      await expect(svc.getById('1', 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /organizations/me ────────────────────────────────────────────────────

  describe('getMe()', () => {
    it('returns the caller\'s organization', async () => {
      const org = makeOrg();
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(org) });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.getMe(1);

      expect(result.organization.id).toBe('1');
    });

    it('throws NotFoundException when org does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new OrganizationsService(repo as any);

      await expect(svc.getMe(1)).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /organizations ───────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a new organization', async () => {
      const org = makeOrg();
      const repo = makeRepo({
        create: jest.fn().mockReturnValue(org),
        save: jest.fn().mockResolvedValue(org),
      });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.create({ name: 'Test Org', code: 'TEST', timezone: 'Asia/Bangkok' });

      expect(result.organization.code).toBe('TEST');
    });

    it('throws ConflictException when org code already exists', async () => {
      const repo = makeRepo({
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockRejectedValue({ code: '23505' }),
      });
      const svc = new OrganizationsService(repo as any);

      await expect(
        svc.create({ name: 'Dup', code: 'DUP', timezone: 'Asia/Bangkok' }),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults timezone to Asia/Bangkok when not provided', async () => {
      const org = makeOrg({ timezone: 'Asia/Bangkok' });
      const repo = makeRepo({
        create: jest.fn().mockReturnValue(org),
        save: jest.fn().mockResolvedValue(org),
      });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.create({ name: 'Test', code: 'T1' } as any);

      expect(result.organization.timezone).toBe('Asia/Bangkok');
    });
  });

  // ── PATCH /organizations/:orgId ──────────────────────────────────────────────

  describe('patch()', () => {
    it('updates and returns the organization when caller belongs to the same org', async () => {
      const org = makeOrg();
      const updated = makeOrg({ name: 'Updated Org' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(org),
        save: jest.fn().mockResolvedValue(updated),
      });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.patch('1', 1, { name: 'Updated Org' });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(repo.save).toHaveBeenCalled();
      expect(result.organization.name).toBe('Updated Org');
    });

    it('allows ADMIN to patch any org regardless of orgId mismatch', async () => {
      const org = makeOrg({ id: '99' });
      const updated = makeOrg({ id: '99', name: 'Admin Updated' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(org),
        save: jest.fn().mockResolvedValue(updated),
      });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.patch('99', 1, { name: 'Admin Updated' }, ['ADMIN']);

      expect(result.organization.name).toBe('Admin Updated');
    });

    it('throws ForbiddenException when caller belongs to a different org', async () => {
      const repo = makeRepo();
      const svc = new OrganizationsService(repo as any);

      await expect(svc.patch('2', 1, { name: 'X' })).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the org does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new OrganizationsService(repo as any);

      await expect(svc.patch('1', 1, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('applies only provided fields (partial update)', async () => {
      const org = makeOrg({ name: 'Old Name', code: 'OLD' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(org),
        save: jest.fn().mockImplementation((o: any) => Promise.resolve(o)),
      });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.patch('1', 1, { name: 'New Name' });

      expect(result.organization.name).toBe('New Name');
      expect(result.organization.code).toBe('OLD');
    });
  });

  // ── DELETE /organizations/:orgId ─────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the organization and returns ok + organizationId', async () => {
      const org = makeOrg();
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(org),
        remove: jest.fn().mockResolvedValue(undefined),
      });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.delete('1', 1);

      expect(repo.remove).toHaveBeenCalledWith(org);
      expect(result).toEqual({ ok: true, organizationId: '1' });
    });

    it('allows ADMIN to delete any org', async () => {
      const org = makeOrg({ id: '99' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(org),
        remove: jest.fn().mockResolvedValue(undefined),
      });
      const svc = new OrganizationsService(repo as any);

      const result = await svc.delete('99', 1, ['ADMIN']);

      expect(result).toEqual({ ok: true, organizationId: '99' });
    });

    it('throws ForbiddenException when caller belongs to a different org', async () => {
      const repo = makeRepo();
      const svc = new OrganizationsService(repo as any);

      await expect(svc.delete('2', 1)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the org does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new OrganizationsService(repo as any);

      await expect(svc.delete('1', 1)).rejects.toThrow(NotFoundException);
    });
  });
});
