// src/core/units/units.service.ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Unit } from '@/database/entities/core/unit.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { Worker } from '@/database/entities/workers/worker.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { PatchUnitDto } from './dto/patch-unit.dto';
import { ListUnitsQueryDto } from './dto/list-units.query.dto';

type JwtCtx = {
  organizationId: number;
  roles: string[];
  unitIds: number[];
};

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(UnitMembership)
    private readonly membershipRepo: Repository<UnitMembership>,
    @InjectRepository(WorkerUnitMembership)
    private readonly workerMembershipRepo: Repository<WorkerUnitMembership>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  private isAdmin(ctx: JwtCtx) {
    return ctx.roles.includes('ADMIN') || ctx.roles.includes('super_admin');
  }

  private assertOrg(ctx: JwtCtx, orgId: string) {
    if (this.isAdmin(ctx)) return;
    if (Number(orgId) !== Number(ctx.organizationId)) {
      throw new ForbiddenException('Forbidden: organization mismatch');
    }
  }

  private findUnit(ctx: JwtCtx, unitId: string) {
    if (this.isAdmin(ctx)) {
      return this.unitRepo.findOne({ where: { id: String(unitId) } });
    }
    // Allow access if user is an explicit member of this unit (unitIds claim)
    if (ctx.unitIds.includes(Number(unitId))) {
      return this.unitRepo.findOne({ where: { id: String(unitId) } });
    }
    return this.unitRepo.findOne({
      where: { id: String(unitId), organization_id: String(ctx.organizationId) },
    });
  }

  async list(ctx: JwtCtx, q: ListUnitsQueryDto) {
    const limit = Math.min(Math.max(Number(q.limit ?? 100), 1), 300);
    const offset = Math.max(Number(q.offset ?? 0), 0);
    const sort = (q.sort ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const activeFilter =
      q.active === undefined ? undefined : q.active !== 'false';

    const qb = this.unitRepo.createQueryBuilder('u');

    if (!this.isAdmin(ctx)) {
      qb.where('u.organization_id = :orgId', { orgId: String(ctx.organizationId) });
    }

    if (activeFilter !== undefined) {
      qb.andWhere('u.is_active = :isActive', { isActive: activeFilter });
    }

    if (q.siteId) {
      qb.andWhere('u.site_id = :siteId', { siteId: String(q.siteId) });
    }

    if (q.search && q.search.trim()) {
      const s = `%${q.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(u.name) LIKE :s OR LOWER(u.code) LIKE :s)', { s });
    }

    qb.orderBy('u.created_at', sort as any).take(limit).skip(offset);

    const rows = await qb.getMany();

    return {
      items: rows.map((u) => ({
        id: u.id,
        organizationId: u.organization_id,
        siteId: u.site_id,
        name: u.name,
        code: u.code,
        description: u.description,
        attributes: u.attributes ?? {},
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      meta: { limit, offset },
    };
  }

  async getById(ctx: JwtCtx, unitId: string) {
    const u = await this.findUnit(ctx, unitId);
    if (!u) throw new NotFoundException('Unit not found');

    return {
      unit: {
        id: u.id,
        organizationId: u.organization_id,
        siteId: u.site_id,
        name: u.name,
        code: u.code,
        description: u.description,
        attributes: u.attributes ?? {},
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      },
    };
  }

  async create(ctx: JwtCtx, dto: CreateUnitDto) {
    this.assertOrg(ctx, dto.organizationId);

    const row = this.unitRepo.create({
      organization_id: String(dto.organizationId),
      site_id: dto.siteId === undefined ? null : (dto.siteId as any),
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      attributes: dto.attributes ?? {},
      is_active: dto.isActive ?? true,
    });

    const saved = await this.unitRepo.save(row);

    return {
      unit: {
        id: saved.id,
        organizationId: saved.organization_id,
        siteId: saved.site_id,
        name: saved.name,
        code: saved.code,
        description: saved.description,
        attributes: saved.attributes ?? {},
        isActive: saved.is_active,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      },
    };
  }

  async patch(ctx: JwtCtx, unitId: string, dto: PatchUnitDto) {
    const u = await this.findUnit(ctx, unitId);
    if (!u) throw new NotFoundException('Unit not found');

    if (dto.siteId !== undefined) u.site_id = dto.siteId as any;
    if (dto.name !== undefined) u.name = dto.name;
    if (dto.code !== undefined) u.code = dto.code;
    if (dto.description !== undefined) u.description = dto.description ?? null;
    if (dto.attributes !== undefined) u.attributes = dto.attributes;
    if (dto.isActive !== undefined) u.is_active = dto.isActive;

    const saved = await this.unitRepo.save(u);

    return {
      unit: {
        id: saved.id,
        organizationId: saved.organization_id,
        siteId: saved.site_id,
        name: saved.name,
        code: saved.code,
        description: saved.description,
        attributes: saved.attributes ?? {},
        isActive: saved.is_active,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      },
    };
  }

  async deactivate(ctx: JwtCtx, unitId: string) {
    const u = await this.findUnit(ctx, unitId);
    if (!u) throw new NotFoundException('Unit not found');

    u.is_active = false;
    await this.unitRepo.save(u);

    return { ok: true, unitId: u.id };
  }

  async delete(ctx: JwtCtx, unitId: string) {
    const u = await this.findUnit(ctx, unitId);
    if (!u) throw new NotFoundException('Unit not found');

    await this.unitRepo.remove(u);
    return { ok: true, unitId };
  }

  // ── Membership ──────────────────────────────────────────────────────────────

  async listMembers(ctx: JwtCtx, unitId: string) {
    const u = await this.findUnit(ctx, unitId);
    if (!u) throw new NotFoundException('Unit not found');

    // User-account memberships (unit_memberships)
    const userRows = await this.membershipRepo.find({ where: { unit_id: String(unitId) } });

    // Worker-profile memberships (worker_unit_memberships) joined with worker details
    const workerRows = await this.workerMembershipRepo.find({ where: { unit_id: String(unitId) } });
    const workerIds = workerRows.map((r) => r.worker_id);
    const workers = workerIds.length
      ? await this.workerRepo.findByIds(workerIds)
      : [];
    const workerMap = new Map(workers.map((w) => [String(w.id), w]));

    const userMembers = userRows.map((m) => ({
      id: m.id,
      type: 'user' as const,
      userId: m.user_id,
      workerId: null,
      unitId: m.unit_id,
      roleCode: m.role_code,
      name: null,
      workerCode: null,
      createdAt: m.created_at,
    }));

    const workerMembers = workerRows.map((m) => {
      const w = workerMap.get(String(m.worker_id));
      return {
        id: String(m.worker_id),
        type: 'worker' as const,
        userId: w?.linked_user_id ?? null,
        workerId: m.worker_id,
        unitId: m.unit_id,
        roleCode: m.role_code ?? 'NURSE',
        name: w?.full_name ?? null,
        workerCode: w?.worker_code ?? null,
        createdAt: w?.created_at ?? null,
      };
    });

    return { members: [...userMembers, ...workerMembers] };
  }

  async addMember(ctx: JwtCtx, unitId: string, userId: string, roleCode: string) {
    const u = await this.findUnit(ctx, unitId);
    if (!u) throw new NotFoundException('Unit not found');

    const existing = await this.membershipRepo.findOne({
      where: { unit_id: String(unitId), user_id: String(userId) },
    });
    if (existing) throw new ConflictException('User is already a member of this unit');

    const row = this.membershipRepo.create({
      unit_id: String(unitId),
      user_id: String(userId),
      role_code: roleCode ?? 'NURSE',
    });
    const saved = await this.membershipRepo.save(row);

    return {
      member: {
        id: saved.id,
        userId: saved.user_id,
        unitId: saved.unit_id,
        roleCode: saved.role_code,
        createdAt: saved.created_at,
      },
    };
  }

  async removeMember(ctx: JwtCtx, unitId: string, userId: string) {
    const u = await this.findUnit(ctx, unitId);
    if (!u) throw new NotFoundException('Unit not found');

    const row = await this.membershipRepo.findOne({
      where: { unit_id: String(unitId), user_id: String(userId) },
    });
    if (!row) throw new NotFoundException('Membership not found');

    await this.membershipRepo.remove(row);
    return { ok: true };
  }
}
