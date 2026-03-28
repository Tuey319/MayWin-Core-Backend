import { RolesController } from '../src/core/roles/roles.controller';
import { RolesService } from '../src/core/roles/roles.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRole(overrides: Partial<any> = {}) {
  return {
    id: 'r1',
    code: 'NURSE',
    name: 'Nurse',
    description: 'Registered Nurse',
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('RolesController', () => {
  it('should be defined', () => {
    const controller = new RolesController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── RolesService ───────────────────────────────────────────────────────────────

describe('RolesService', () => {
  it('should be defined', () => {
    const svc = new RolesService({} as any);
    expect(svc).toBeDefined();
  });

  // ── GET /roles ───────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns all roles mapped to API shape', async () => {
      const roles = [
        makeRole({ id: 'r1', code: 'NURSE', name: 'Nurse' }),
        makeRole({ id: 'r2', code: 'ADMIN', name: 'Admin' }),
      ];
      const repo = { find: jest.fn().mockResolvedValue(roles) };
      const svc = new RolesService(repo as any);

      const result = await svc.list();

      expect(repo.find).toHaveBeenCalledWith({ order: { created_at: 'ASC' } });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ id: 'r1', code: 'NURSE', name: 'Nurse' });
    });

    it('returns empty items array when no roles exist', async () => {
      const repo = { find: jest.fn().mockResolvedValue([]) };
      const svc = new RolesService(repo as any);

      const result = await svc.list();

      expect(result.items).toHaveLength(0);
    });

    it('includes description and createdAt in each item', async () => {
      const role = makeRole({ description: 'Registered Nurse', created_at: new Date('2024-06-01') });
      const repo = { find: jest.fn().mockResolvedValue([role]) };
      const svc = new RolesService(repo as any);

      const result = await svc.list();

      expect(result.items[0].description).toBe('Registered Nurse');
      expect(result.items[0].createdAt).toEqual(new Date('2024-06-01'));
    });
  });
});
