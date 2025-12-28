// src/core/unit-config/shift-templates/shift-templates.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@Injectable()
export class ShiftTemplatesService {
  constructor(
    @InjectRepository(ShiftTemplate)
    private readonly repo: Repository<ShiftTemplate>,
  ) {}

  async create(orgId: string, unitId: string, dto: CreateShiftTemplateDto) {
    const existing = await this.repo.findOne({
      where: {
        organization_id: orgId,
        unit_id: unitId,
        code: dto.code,
      },
    });

    if (existing) {
      throw new ConflictException(`Shift template code already exists: ${dto.code}`);
    }

    const payload: DeepPartial<ShiftTemplate> = {
      organization_id: orgId,
      unit_id: unitId,
      code: dto.code,
      name: dto.name,
      start_time: dto.startTime,
      end_time: dto.endTime,
      attributes: dto.attributes ?? {},
      is_active: dto.isActive ?? true,
    };

    const row = this.repo.create(payload);     
    const saved = await this.repo.save(row);  
    return this.toApi(saved);
  }

  async update(orgId: string, unitId: string, id: string, dto: UpdateShiftTemplateDto) {
    const row = await this.repo.findOne({
      where: {
        id,
        organization_id: orgId,
        unit_id: unitId,
      },
    });

    if (!row) throw new NotFoundException('Shift template not found');

    if (dto.code && dto.code !== row.code) {
      const dup = await this.repo.findOne({
        where: {
          organization_id: orgId,
          unit_id: unitId,
          code: dto.code,
        },
      });
      if (dup) throw new ConflictException(`Shift template code already exists: ${dto.code}`);
      row.code = dto.code;
    }

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.startTime !== undefined) row.start_time = dto.startTime;
    if (dto.endTime !== undefined) row.end_time = dto.endTime;
    if (dto.attributes !== undefined) row.attributes = dto.attributes ?? {};
    if (dto.isActive !== undefined) row.is_active = dto.isActive;

    const saved = await this.repo.save(row);
    return this.toApi(saved);
  }

  async deactivate(orgId: string, unitId: string, id: string) {
    const row = await this.repo.findOne({
      where: {
        id,
        organization_id: orgId,
        unit_id: unitId,
      },
    });

    if (!row) throw new NotFoundException('Shift template not found');

    row.is_active = false;
    const saved = await this.repo.save(row);
    return this.toApi(saved);
  }

  private toApi(s: ShiftTemplate) {
    return {
      id: s.id,
      unitId: s.unit_id,
      code: s.code,
      name: s.name,
      startTime: s.start_time,
      endTime: s.end_time,
      attributes: s.attributes ?? {},
      isActive: s.is_active,
      createdAt: s.created_at,
    };
  }
}
