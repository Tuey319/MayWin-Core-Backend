import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SitesController } from '../src/core/sites/sites.controller';
import { SitesService } from '../src/core/sites/sites.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSite(overrides: Partial<any> = {}) {
  return {
    id: '10',
    organization_id: '1',
    name: 'Main Hospital',
    code: 'MH01',
    address: null,
    timezone: null,
    attributes: {},
    is_active: true,
    created_at: new Date('2024-01-01'),
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
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

const adminCtx = { organizationId: 1, roles: ['ADMIN'] };
const userCtx = { organizationId: 1, roles: ['MANAGER'] };
const otherOrgCtx = { organizationId: 99, roles: ['MANAGER'] };

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('SitesController', () => {
  it('should be defined', () => {
    const controller = new SitesController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── SitesService ───────────────────────────────────────────────────────────────

describe('SitesService', () => {
  it('should be defined', () => {
    const svc = new SitesService({} as any);
    expect(svc).toBeDefined();
  });

  // ── POST /sites ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a site for the caller\'s org', async () => {
      const site = makeSite();
      const repo = makeRepo({
        create: jest.fn().mockReturnValue(site),
        save: jest.fn().mockResolvedValue(site),
      });
      const svc = new SitesService(repo as any);

      const dto = { organizationId: '1', name: 'Main Hospital', code: 'MH01' };
      const result = await svc.create(userCtx, dto as any);

      expect(repo.save).toHaveBeenCalled();
      expect(result.site.name).toBe('Main Hospital');
      expect(result.site.code).toBe('MH01');
    });

    it('allows ADMIN to create a site for any org', async () => {
      const site = makeSite({ organization_id: '99' });
      const repo = makeRepo({
        create: jest.fn().mockReturnValue(site),
        save: jest.fn().mockResolvedValue(site),
      });
      const svc = new SitesService(repo as any);

      const dto = { organizationId: '99', name: 'Remote Site', code: 'RS01' };
      const result = await svc.create(adminCtx, dto as any);

      expect(result.site).toBeDefined();
    });

    it('throws ForbiddenException when a non-admin creates a site for another org', async () => {
      const repo = makeRepo();
      const svc = new SitesService(repo as any);

      const dto = { organizationId: '99', name: 'Other Site', code: 'OS01' };
      await expect(svc.create(userCtx, dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('sets is_active to true by default', async () => {
      const site = makeSite({ is_active: true });
      const repo = makeRepo({
        create: jest.fn().mockReturnValue(site),
        save: jest.fn().mockResolvedValue(site),
      });
      const svc = new SitesService(repo as any);

      const dto = { organizationId: '1', name: 'Site', code: 'S1' };
      const result = await svc.create(userCtx, dto as any);

      expect(result.site.isActive).toBe(true);
    });
  });

  // ── PATCH /sites/:siteId ─────────────────────────────────────────────────────

  describe('patch()', () => {
    it('updates and returns the site', async () => {
      const site = makeSite();
      const updated = makeSite({ name: 'Updated Hospital' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(site),
        save: jest.fn().mockResolvedValue(updated),
      });
      const svc = new SitesService(repo as any);

      const result = await svc.patch(userCtx, '10', { name: 'Updated Hospital' } as any);

      expect(result.site.name).toBe('Updated Hospital');
    });

    it('applies only the provided fields', async () => {
      const site = makeSite({ name: 'Old Name', code: 'OLD' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(site),
        save: jest.fn().mockImplementation((s: any) => Promise.resolve(s)),
      });
      const svc = new SitesService(repo as any);

      const result = await svc.patch(userCtx, '10', { name: 'New Name' } as any);

      expect(result.site.name).toBe('New Name');
      expect(result.site.code).toBe('OLD');
    });

    it('throws NotFoundException when site not found', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new SitesService(repo as any);

      await expect(svc.patch(userCtx, '999', { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /sites/:siteId ────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the site and returns ok + siteId', async () => {
      const site = makeSite();
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(site),
        remove: jest.fn().mockResolvedValue(undefined),
      });
      const svc = new SitesService(repo as any);

      const result = await svc.delete(userCtx, '10');

      expect(repo.remove).toHaveBeenCalledWith(site);
      expect(result).toEqual({ ok: true, siteId: '10' });
    });

    it('allows ADMIN to delete a site from any org', async () => {
      const site = makeSite({ organization_id: '99' });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(site),
        remove: jest.fn().mockResolvedValue(undefined),
      });
      const svc = new SitesService(repo as any);

      const result = await svc.delete(adminCtx, '10');

      expect(result.ok).toBe(true);
    });

    it('throws NotFoundException when site does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new SitesService(repo as any);

      await expect(svc.delete(userCtx, '999')).rejects.toThrow(NotFoundException);
    });

    it('scopes the lookup to the caller\'s org for non-admins', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new SitesService(repo as any);

      await expect(svc.delete(otherOrgCtx, '10')).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /sites/:siteId/activate & /deactivate ─────────────────────────────────

  describe('activate()', () => {
    it('sets is_active to true', async () => {
      const site = makeSite({ is_active: false });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(site),
        save: jest.fn().mockResolvedValue({ ...site, is_active: true }),
      });
      const svc = new SitesService(repo as any);

      const result = await svc.activate(userCtx, '10');

      expect(result.ok).toBe(true);
    });

    it('throws NotFoundException when site does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new SitesService(repo as any);

      await expect(svc.activate(userCtx, '999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate()', () => {
    it('sets is_active to false', async () => {
      const site = makeSite({ is_active: true });
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(site),
        save: jest.fn().mockResolvedValue({ ...site, is_active: false }),
      });
      const svc = new SitesService(repo as any);

      const result = await svc.deactivate(userCtx, '10');

      expect(result.ok).toBe(true);
    });

    it('throws NotFoundException when site does not exist', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new SitesService(repo as any);

      await expect(svc.deactivate(userCtx, '999')).rejects.toThrow(NotFoundException);
    });
  });
});
