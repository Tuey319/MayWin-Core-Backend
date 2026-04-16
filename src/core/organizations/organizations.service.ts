// src/core/organizations/organization.service.ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Organization } from '@/database/entities/core/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { PatchOrganizationDto } from './dto/patch-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  private isSuperAdmin(roles: string[]): boolean {
    return roles.includes('super_admin') || roles.includes('ADMIN');
  }

  private assertSameOrg(requestOrgId: number, orgId: string, roles: string[] = []) {
    if (this.isSuperAdmin(roles)) return;
    if (Number(orgId) !== Number(requestOrgId)) {
      throw new ForbiddenException('Forbidden: organization mismatch');
    }
  }

  /** GET /organizations — returns all orgs for super_admin/ADMIN, otherwise just the caller's org */
  async list(requestOrgId: number, roles: string[]) {
    if (this.isSuperAdmin(roles)) {
      const orgs = await this.orgRepo.find();
      return { organizations: orgs.map((o) => this.toApi(o)) };
    }
    const org = await this.orgRepo.findOne({ where: { id: String(requestOrgId) } });
    if (!org) throw new NotFoundException('Organization not found');
    return { organizations: [this.toApi(org)] };
  }

  /** GET /organizations/:orgId */
  async getById(orgId: string, requestOrgId: number, roles: string[] = []) {
    this.assertSameOrg(requestOrgId, orgId, roles);
    const org = await this.orgRepo.findOne({ where: { id: String(orgId) } });
    if (!org) throw new NotFoundException('Organization not found');
    return { organization: this.toApi(org) };
  }

  /** GET /organizations/me */
  async getMe(requestOrgId: number) {
    const org = await this.orgRepo.findOne({ where: { id: String(requestOrgId) } });
    if (!org) throw new NotFoundException('Organization not found');
    return { organization: this.toApi(org) };
  }

  private toApi(org: Organization) {
    return {
      id: org.id,
      name: org.name,
      code: org.code,
      timezone: org.timezone,
      attributes: org.attributes ?? {},
      createdAt: org.created_at,
      updatedAt: org.updated_at,
    };
  }

  // Optional (admin-only later). Kept for completeness.
  async create(dto: CreateOrganizationDto) {
    const row = this.orgRepo.create({
      name: dto.name,
      code: dto.code,
      timezone: dto.timezone ?? 'Asia/Bangkok',
      attributes: dto.attributes ?? {},
    });
    try {
      const saved = await this.orgRepo.save(row);
      return { organization: this.toApi(saved) };
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(`Organization with code "${dto.code}" already exists`);
      }
      throw err;
    }
  }

  async patch(orgId: string, requestOrgId: number, dto: PatchOrganizationDto, roles: string[] = []) {
    this.assertSameOrg(requestOrgId, orgId, roles);

    const org = await this.orgRepo.findOne({ where: { id: String(orgId) } });
    if (!org) throw new NotFoundException('Organization not found');

    if (dto.name !== undefined) org.name = dto.name;
    if (dto.code !== undefined) org.code = dto.code;
    if (dto.timezone !== undefined) org.timezone = dto.timezone;
    if (dto.attributes !== undefined) org.attributes = dto.attributes;

    const saved = await this.orgRepo.save(org);
    return { organization: this.toApi(saved) };
  }

  async delete(orgId: string, requestOrgId: number, roles: string[] = []) {
    this.assertSameOrg(requestOrgId, orgId, roles);

    const org = await this.orgRepo.findOne({ where: { id: String(orgId) } });
    if (!org) throw new NotFoundException('Organization not found');

    await this.orgRepo.remove(org);
    return { ok: true, organizationId: orgId };
  }
}
