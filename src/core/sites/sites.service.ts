// src/core/sites/sites.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Site } from '@/database/entities/core/site.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { PatchSiteDto } from './dto/patch-site.dto';
import { ListSitesQueryDto } from './dto/list-sites.query.dto';

type JwtCtx = { organizationId: number; roles: string[] };

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
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

  private findSite(ctx: JwtCtx, siteId: string) {
    if (this.isAdmin(ctx)) {
      return this.siteRepo.findOne({ where: { id: String(siteId) } });
    }
    return this.siteRepo.findOne({
      where: { id: String(siteId), organization_id: String(ctx.organizationId) },
    });
  }

  async list(ctx: JwtCtx, q: ListSitesQueryDto) {
    const limit = Math.min(Math.max(Number(q.limit ?? 100), 1), 300);
    const offset = Math.max(Number(q.offset ?? 0), 0);
    const sort = (q.sort ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const activeFilter =
      q.active === undefined ? undefined : q.active !== 'false';

    const qb = this.siteRepo.createQueryBuilder('s');

    if (!this.isAdmin(ctx)) {
      qb.where('s.organization_id = :orgId', { orgId: String(ctx.organizationId) });
    }

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
      items: rows.map((s) => this.toApi(s)),
      meta: { limit, offset },
    };
  }

  async create(ctx: JwtCtx, dto: CreateSiteDto) {
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

    return { site: this.toApi(saved) };
  }

  private toApi(s: Site) {
    return {
      id: s.id,
      organizationId: s.organization_id,
      name: s.name,
      code: s.code,
      address: s.address,
      timezone: s.timezone,
      attributes: s.attributes ?? {},
      isActive: s.is_active,
      createdAt: s.created_at,
    };
  }

  async patch(ctx: JwtCtx, siteId: string, dto: PatchSiteDto) {
    const s = await this.findSite(ctx, siteId);
    if (!s) throw new NotFoundException('Site not found');

    if (dto.name !== undefined) s.name = dto.name;
    if (dto.code !== undefined) s.code = dto.code;
    if (dto.address !== undefined) s.address = dto.address ?? null;
    if (dto.timezone !== undefined) s.timezone = dto.timezone ?? null;
    if (dto.attributes !== undefined) s.attributes = dto.attributes;

    const saved = await this.siteRepo.save(s);
    return { site: this.toApi(saved) };
  }

  async activate(ctx: JwtCtx, siteId: string) {
    const s = await this.findSite(ctx, siteId);
    if (!s) throw new NotFoundException('Site not found');

    s.is_active = true;
    await this.siteRepo.save(s);
    return { ok: true, siteId: s.id };
  }

  async deactivate(ctx: JwtCtx, siteId: string) {
    const s = await this.findSite(ctx, siteId);
    if (!s) throw new NotFoundException('Site not found');

    s.is_active = false;
    await this.siteRepo.save(s);
    return { ok: true, siteId: s.id };
  }

  async delete(ctx: JwtCtx, siteId: string) {
    const s = await this.findSite(ctx, siteId);
    if (!s) throw new NotFoundException('Site not found');

    await this.siteRepo.remove(s);
    return { ok: true, siteId };
  }
}
