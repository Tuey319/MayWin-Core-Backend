// src/core/units/units.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Unit } from '@/database/entities/core/unit.entity';
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
  ) {}

  private canSeeAllUnits(ctx: JwtCtx) {
    const roles = ctx.roles ?? [];
    return roles.includes('ORG_ADMIN') || roles.includes('UNIT_MANAGER');
  }

  private assertOrg(ctx: JwtCtx, orgId: string) {
    if (Number(orgId) !== Number(ctx.organizationId)) {
      throw new ForbiddenException('Forbidden: organization mismatch');
    }
  }

  private assertCanAccessUnit(ctx: JwtCtx, unitId: string) {
    if (this.canSeeAllUnits(ctx)) return;
    const allowed = new Set((ctx.unitIds ?? []).map((x) => Number(x)));
    if (!allowed.has(Number(unitId))) {
      throw new ForbiddenException('Forbidden: unit not in token context');
    }
  }

  async list(ctx: JwtCtx, q: ListUnitsQueryDto) {
    const limit = Math.min(Math.max(Number(q.limit ?? 100), 1), 300);
    const offset = Math.max(Number(q.offset ?? 0), 0);
    const sort = (q.sort ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const activeFilter =
      q.active === undefined ? undefined : q.active !== 'false';

    const qb = this.unitRepo
      .createQueryBuilder('u')
      .where('u.organization_id = :orgId', { orgId: String(ctx.organizationId) });

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

    // if not admin/manager: restrict to unitIds in token
    if (!this.canSeeAllUnits(ctx)) {
      const ids = (ctx.unitIds ?? []).map((x) => Number(x)).filter((n) => Number.isFinite(n));
      if (!ids.length) return { items: [], meta: { limit, offset } };
      qb.andWhere('u.id IN (:...ids)', { ids });
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
    this.assertCanAccessUnit(ctx, unitId);

    const u = await this.unitRepo.findOne({
      where: { id: String(unitId), organization_id: String(ctx.organizationId) },
    });
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
    // must match caller org
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
    this.assertCanAccessUnit(ctx, unitId);

    const u = await this.unitRepo.findOne({
      where: { id: String(unitId), organization_id: String(ctx.organizationId) },
    });
    if (!u) throw new NotFoundException('Unit not found');

    // only admins/managers can edit; normal users read-only
    if (!this.canSeeAllUnits(ctx)) {
      throw new ForbiddenException('Forbidden: insufficient role to edit unit');
    }

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
    // only admins/managers
    if (!this.canSeeAllUnits(ctx)) {
      throw new ForbiddenException('Forbidden: insufficient role to deactivate unit');
    }

    const u = await this.unitRepo.findOne({
      where: { id: String(unitId), organization_id: String(ctx.organizationId) },
    });
    if (!u) throw new NotFoundException('Unit not found');

    u.is_active = false;
    await this.unitRepo.save(u);

    return { ok: true, unitId: u.id };
  }
}
