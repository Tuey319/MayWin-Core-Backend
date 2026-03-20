// src/core/organizations/schedule-containers.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { CreateScheduleContainerDto } from './dto/create-schedule-container.dto';
import { UpdateScheduleContainerDto } from './dto/update-schedule-container.dto';

/** Maps API status values to/from Schedule entity status values */
const STATUS_TO_ENTITY: Record<string, string> = {
  draft: 'DRAFT',
  active: 'PUBLISHED',
  archived: 'ARCHIVED',
};

const STATUS_TO_API: Record<string, string> = {
  DRAFT: 'draft',
  PUBLISHED: 'active',
  ARCHIVED: 'archived',
};

@Injectable()
export class ScheduleContainersService {
  constructor(
    @InjectRepository(Schedule)
    private readonly repo: Repository<Schedule>,
  ) {}

  async list(orgId: string) {
    const rows = await this.repo.find({
      where: { organization_id: orgId },
      order: { created_at: 'DESC' },
    });
    return { containers: rows.map((r) => this.toApi(r)) };
  }

  async create(orgId: string, dto: CreateScheduleContainerDto, createdBy: string) {
    const row = this.repo.create({
      organization_id: orgId,
      unit_id: null,
      name: dto.name,
      start_date: dto.start,
      end_date: dto.end,
      status: (STATUS_TO_ENTITY[dto.status ?? 'draft'] ?? 'DRAFT') as any,
      notes: dto.notes ?? null,
      constraint_profile_id: dto.profileId ?? null,
      created_by: createdBy,
      job_id: null,
      last_solver_run_id: null,
      current_run_id: null,
      published_at: null,
      published_by: null,
      attributes: {
        site: dto.site ?? null,
        dept: dto.dept ?? null,
      },
    });
    const saved = await this.repo.save(row);
    return { container: this.toApi(saved) };
  }

  async update(orgId: string, id: string, dto: UpdateScheduleContainerDto) {
    const row = await this.repo.findOne({ where: { id, organization_id: orgId } });
    if (!row) throw new NotFoundException('Schedule container not found');

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.start !== undefined) row.start_date = dto.start;
    if (dto.end !== undefined) row.end_date = dto.end;
    if (dto.status !== undefined) row.status = (STATUS_TO_ENTITY[dto.status] ?? row.status) as any;
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    if (dto.profileId !== undefined) row.constraint_profile_id = dto.profileId ?? null;
    if (dto.site !== undefined || dto.dept !== undefined) {
      row.attributes = {
        ...row.attributes,
        ...(dto.site !== undefined ? { site: dto.site } : {}),
        ...(dto.dept !== undefined ? { dept: dto.dept } : {}),
      };
    }

    const saved = await this.repo.save(row);
    return { container: this.toApi(saved) };
  }

  async delete(orgId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, organization_id: orgId } });
    if (!row) throw new NotFoundException('Schedule container not found');
    await this.repo.remove(row);
    return { ok: true };
  }

  private toApi(r: Schedule) {
    return {
      id: r.id,
      name: r.name,
      site: r.attributes?.site ?? null,
      dept: r.attributes?.dept ?? null,
      start: r.start_date,
      end: r.end_date,
      status: STATUS_TO_API[r.status] ?? r.status.toLowerCase(),
      notes: r.notes ?? null,
      profileId: r.constraint_profile_id ?? null,
    };
  }
}
