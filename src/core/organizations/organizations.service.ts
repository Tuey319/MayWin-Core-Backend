// src/core/organizations/organization.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  private assertSameOrg(requestOrgId: number, orgId: string) {
    if (Number(orgId) !== Number(requestOrgId)) {
      throw new ForbiddenException('Forbidden: organization mismatch');
    }
  }

  async getMe(requestOrgId: number) {
    const org = await this.orgRepo.findOne({ where: { id: String(requestOrgId) } });
    if (!org) throw new NotFoundException('Organization not found');

    return {
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
        timezone: org.timezone,
        attributes: org.attributes ?? {},
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      },
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

    const saved = await this.orgRepo.save(row);

    return {
      organization: {
        id: saved.id,
        name: saved.name,
        code: saved.code,
        timezone: saved.timezone,
        attributes: saved.attributes ?? {},
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      },
    };
  }

  async patch(orgId: string, requestOrgId: number, dto: PatchOrganizationDto) {
    this.assertSameOrg(requestOrgId, orgId);

    const org = await this.orgRepo.findOne({ where: { id: String(orgId) } });
    if (!org) throw new NotFoundException('Organization not found');

    if (dto.name !== undefined) org.name = dto.name;
    if (dto.code !== undefined) org.code = dto.code;
    if (dto.timezone !== undefined) org.timezone = dto.timezone;
    if (dto.attributes !== undefined) org.attributes = dto.attributes;

    const saved = await this.orgRepo.save(org);

    return {
      organization: {
        id: saved.id,
        name: saved.name,
        code: saved.code,
        timezone: saved.timezone,
        attributes: saved.attributes ?? {},
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      },
    };
  }
}
