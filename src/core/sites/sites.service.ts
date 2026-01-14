// src/core/sites/sites.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Site } from '@/database/entities/core/site.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { ListSitesQueryDto } from './dto/list-sites.query.dto';

type JwtCtx = { organizationId: number; roles: string[] };

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
  ) {}

  private isAdmin(ctx: JwtCtx) {
    const r = ctx.roles ?? [];
    return r.includes('ORG_ADMIN') || r.includes('UNIT_MANAGER');
  }

  private assertOrg(ctx: JwtCtx, orgId: string) {
    if (Number(orgId) !== Number(ctx.organizationId)) {
      throw new ForbiddenException('Forbidden: organization mismatch');
    }
  }

  async list(ctx: JwtCtx, q: ListSitesQueryDto) {
    const limit = Math.min(Math.max(Number(q.limit ?? 100), 1), 300);
    const offset = Math.max(Number(q.offset ?? 0), 0);
    const sort = (q.sort ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const activeFilter =
      q.active === undefined ? undefined : q.active !== 'false';

    const qb = this.siteRepo
      .createQueryBuilder('s')
      .where('s.organization_id = :orgId', { orgId: String(ctx.organizationId) });

    if (activeFilter !== undefined) {
      qb.andWhere('s.is_active = :isActive', { isActive: activeFilter });
    }

    if (q.search && q.search.trim()) {
      const s = `%${q.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(s.name) LIKE :s OR LOWER(s.code) LIKE :s)', { s });
    }

    qb.orderBy('s.created_at', sort as any).take(limit).skip(offset);

    const rows = await qb.getMany();

    return {
      items: rows.map((s) => ({
        id: s.id,
        organizationId: s.organization_id,
        name: s.name,
        code: s.code,
        address: s.address,
        timezone: s.timezone,
        attributes: s.attributes ?? {},
        isActive: s.is_active,
        createdAt: s.created_at,
      })),
      meta: { limit, offset },
    };
  }

  async create(ctx: JwtCtx, dto: CreateSiteDto) {
    if (!this.isAdmin(ctx)) throw new ForbiddenException('Forbidden: insufficient role');

    this.assertOrg(ctx, dto.organizationId);

    const row = this.siteRepo.create({
      organization_id: String(dto.organizationId),
      name: dto.name,
      code: dto.code,
      address: dto.address ?? null,
      timezone: dto.timezone ?? null,
      attributes: dto.attributes ?? {},
      is_active: dto.isActive ?? true,
    });

    const saved = await this.siteRepo.save(row);

    return {
      site: {
        id: saved.id,
        organizationId: saved.organization_id,
        name: saved.name,
        code: saved.code,
        address: saved.address,
        timezone: saved.timezone,
        attributes: saved.attributes ?? {},
        isActive: saved.is_active,
        createdAt: saved.created_at,
      },
    };
  }

  async deactivate(ctx: JwtCtx, siteId: string) {
    if (!this.isAdmin(ctx)) throw new ForbiddenException('Forbidden: insufficient role');

    const s = await this.siteRepo.findOne({
      where: { id: String(siteId), organization_id: String(ctx.organizationId) },
    });
    if (!s) throw new NotFoundException('Site not found');

    s.is_active = false;
    await this.siteRepo.save(s);

    return { ok: true, siteId: s.id };
  }
}
