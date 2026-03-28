import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UnitsController } from '../src/core/units/units.controller';
import { UnitsService } from '../src/core/units/units.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<any> = {}) {
  return {
    id: '20',
    organization_id: '1',
    site_id: null,
    name: 'ICU',
    code: 'ICU01',
    description: null,
    attributes: {},
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findByIds: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

const adminCtx = { organizationId: 1, roles: ['ADMIN'], unitIds: [] };
const userCtx = { organizationId: 1, roles: ['MANAGER'], unitIds: [] };
const otherOrgCtx = { organizationId: 99, roles: ['MANAGER'], unitIds: [] };

function makeSvc(unitRepoOverrides: Partial<any> = {}, membershipRepoOverrides: Partial<any> = {}) {
  const unitRepo = makeRepo(unitRepoOverrides);
  const membershipRepo = makeRepo(membershipRepoOverrides);
  const workerMembershipRepo = makeRepo();
  const workerRepo = makeRepo({ findByIds: jest.fn().mockResolvedValue([]) });
  const svc = new UnitsService(
    unitRepo as any,
    membershipRepo as any,
    workerMembershipRepo as any,
    workerRepo as any,
  );
  return { svc, unitRepo, membershipRepo, workerMembershipRepo, workerRepo };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('UnitsController', () => {
  it('should be defined', () => {
    const controller = new UnitsController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── UnitsService ───────────────────────────────────────────────────────────────

describe('UnitsService', () => {
  it('should be defined', () => {
    const svc = new UnitsService({} as any, {} as any, {} as any, {} as any);
    expect(svc).toBeDefined();
  });

  // ── GET /units/:unitId ────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns unit by id', async () => {
      const unit = makeUnit();
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(unit) });

      const result = await svc.getById(userCtx, '20');

      expect(result.unit.id).toBe('20');
      expect(result.unit.name).toBe('ICU');
    });

    it('throws NotFoundException when unit does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.getById(userCtx, '999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /units ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a unit for the caller\'s org', async () => {
      const unit = makeUnit();
      const { svc, unitRepo } = makeSvc({
        create: jest.fn().mockReturnValue(unit),
        save: jest.fn().mockResolvedValue(unit),
      });

      const dto = { organizationId: '1', name: 'ICU', code: 'ICU01' };
      const result = await svc.create(userCtx, dto as any);

      expect(unitRepo.save).toHaveBeenCalled();
      expect(result.unit.name).toBe('ICU');
      expect(result.unit.code).toBe('ICU01');
    });

    it('allows ADMIN to create a unit for any org', async () => {
      const unit = makeUnit({ organization_id: '99' });
      const { svc } = makeSvc({
        create: jest.fn().mockReturnValue(unit),
        save: jest.fn().mockResolvedValue(unit),
      });

      const dto = { organizationId: '99', name: 'Emergency', code: 'EM01' };
      const result = await svc.create(adminCtx, dto as any);

      expect(result.unit).toBeDefined();
    });

    it('throws ForbiddenException when non-admin creates a unit for another org', async () => {
      const { svc } = makeSvc();

      const dto = { organizationId: '99', name: 'Other', code: 'OT01' };
      await expect(svc.create(userCtx, dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('sets is_active to true by default', async () => {
      const unit = makeUnit({ is_active: true });
      const { svc } = makeSvc({
        create: jest.fn().mockReturnValue(unit),
        save: jest.fn().mockResolvedValue(unit),
      });

      const dto = { organizationId: '1', name: 'Ward', code: 'WD01' };
      const result = await svc.create(userCtx, dto as any);

      expect(result.unit.isActive).toBe(true);
    });

    it('stores siteId when provided', async () => {
      const unit = makeUnit({ site_id: '5' });
      const { svc } = makeSvc({
        create: jest.fn().mockReturnValue(unit),
        save: jest.fn().mockResolvedValue(unit),
      });

      const dto = { organizationId: '1', siteId: '5', name: 'Lab', code: 'LAB01' };
      const result = await svc.create(userCtx, dto as any);

      expect(result.unit.siteId).toBe('5');
    });
  });

  // ── PATCH /units/:unitId ──────────────────────────────────────────────────────

  describe('patch()', () => {
    it('updates and returns the unit', async () => {
      const unit = makeUnit();
      const updated = makeUnit({ name: 'Updated ICU' });
      const { svc } = makeSvc({
        findOne: jest.fn().mockResolvedValue(unit),
        save: jest.fn().mockResolvedValue(updated),
      });

      const result = await svc.patch(userCtx, '20', { name: 'Updated ICU' } as any);

      expect(result.unit.name).toBe('Updated ICU');
    });

    it('throws NotFoundException when unit does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.patch(userCtx, '999', { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /units/:unitId ────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the unit and returns ok + unitId', async () => {
      const unit = makeUnit();
      const { svc, unitRepo } = makeSvc({
        findOne: jest.fn().mockResolvedValue(unit),
        remove: jest.fn().mockResolvedValue(undefined),
      });

      const result = await svc.delete(userCtx, '20');

      expect(unitRepo.remove).toHaveBeenCalledWith(unit);
      expect(result).toEqual({ ok: true, unitId: '20' });
    });

    it('allows ADMIN to delete any unit', async () => {
      const unit = makeUnit({ id: '99' });
      const { svc } = makeSvc({
        findOne: jest.fn().mockResolvedValue(unit),
        remove: jest.fn().mockResolvedValue(undefined),
      });

      const result = await svc.delete(adminCtx, '99');

      expect(result.ok).toBe(true);
    });

    it('throws NotFoundException when unit does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.delete(userCtx, '999')).rejects.toThrow(NotFoundException);
    });

    it('scopes lookup to caller\'s org for non-admins (foreign unit → NotFoundException)', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.delete(otherOrgCtx, '20')).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /units/:unitId/deactivate ─────────────────────────────────────────────

  describe('deactivate()', () => {
    it('sets is_active to false and returns ok + unitId', async () => {
      const unit = makeUnit({ is_active: true });
      const { svc } = makeSvc({
        findOne: jest.fn().mockResolvedValue(unit),
        save: jest.fn().mockResolvedValue({ ...unit, is_active: false }),
      });

      const result = await svc.deactivate(userCtx, '20');

      expect(result.ok).toBe(true);
      expect(result.unitId).toBe('20');
    });

    it('throws NotFoundException when unit does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.deactivate(userCtx, '999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /units/:unitId/members ────────────────────────────────────────────────

  describe('listMembers()', () => {
    it('returns user and worker members for a unit', async () => {
      const unit = makeUnit();
      const userMembership = { id: 'm1', unit_id: '20', user_id: 'u1', role_code: 'NURSE', created_at: new Date() };
      const workerMembership = { worker_id: '5', unit_id: '20', role_code: 'NURSE' };
      const worker = { id: '5', full_name: 'Jane', worker_code: 'N001', created_at: new Date(), linked_user_id: null };
      const { svc, membershipRepo, workerMembershipRepo, workerRepo } = makeSvc(
        { findOne: jest.fn().mockResolvedValue(unit) },
      );
      membershipRepo.find.mockResolvedValue([userMembership]);
      workerMembershipRepo.find.mockResolvedValue([workerMembership]);
      workerRepo.findByIds.mockResolvedValue([worker]);

      const result = await svc.listMembers(userCtx, '20');

      expect(result.members).toHaveLength(2);
      const types = result.members.map((m: any) => m.type);
      expect(types).toContain('user');
      expect(types).toContain('worker');
    });

    it('throws NotFoundException when unit does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.listMembers(userCtx, '999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /units/:unitId/members ───────────────────────────────────────────────

  describe('addMember()', () => {
    it('adds a new member to the unit', async () => {
      const unit = makeUnit();
      const membership = { id: 'm1', unit_id: '20', user_id: 'u1', role_code: 'NURSE', created_at: new Date() };
      const { svc, membershipRepo } = makeSvc({ findOne: jest.fn().mockResolvedValue(unit) });
      membershipRepo.findOne.mockResolvedValue(null);
      membershipRepo.create.mockReturnValue(membership);
      membershipRepo.save.mockResolvedValue(membership);

      const result = await svc.addMember(userCtx, '20', 'u1', 'NURSE');

      expect(membershipRepo.save).toHaveBeenCalled();
      expect(result.member.userId).toBe('u1');
    });

    it('throws NotFoundException when unit does not exist', async () => {
      const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(svc.addMember(userCtx, '999', 'u1', 'NURSE')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when user is already a member', async () => {
      const unit = makeUnit();
      const existing = { id: 'm1', unit_id: '20', user_id: 'u1' };
      const { svc, membershipRepo } = makeSvc({ findOne: jest.fn().mockResolvedValue(unit) });
      membershipRepo.findOne.mockResolvedValue(existing);

      await expect(svc.addMember(userCtx, '20', 'u1', 'NURSE')).rejects.toThrow(ConflictException);
    });
  });

  // ── DELETE /units/:unitId/members/:userId ─────────────────────────────────────

  describe('removeMember()', () => {
    it('removes a member from the unit', async () => {
      const unit = makeUnit();
      const membership = { id: 'm1', unit_id: '20', user_id: 'u1' };
      const { svc, membershipRepo } = makeSvc({ findOne: jest.fn().mockResolvedValue(unit) });
      membershipRepo.findOne.mockResolvedValue(membership);
      membershipRepo.remove.mockResolvedValue(undefined);

      const result = await svc.removeMember(userCtx, '20', 'u1');

      expect(membershipRepo.remove).toHaveBeenCalledWith(membership);
      expect(result).toEqual({ ok: true });
    });

    it('throws NotFoundException when membership does not exist', async () => {
      const unit = makeUnit();
      const { svc, membershipRepo } = makeSvc({ findOne: jest.fn().mockResolvedValue(unit) });
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(svc.removeMember(userCtx, '20', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
