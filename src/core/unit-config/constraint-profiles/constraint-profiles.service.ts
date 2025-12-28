// src/core/unit-config/constraint-profiles/constraint-profiles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';
import { CreateConstraintProfileDto } from './dto/create-constraint-profile.dto';
import { UpdateConstraintProfileDto } from './dto/update-constraint-profile.dto';

@Injectable()
export class ConstraintProfilesService {
  constructor(
    @InjectRepository(ConstraintProfile)
    private readonly repo: Repository<ConstraintProfile>,
  ) {}

  async create(unitId: string, dto: CreateConstraintProfileDto) {
    const payload: DeepPartial<ConstraintProfile> = {
      unit_id: unitId,
      name: dto.name,
      max_consecutive_work_days: dto.maxConsecutiveWorkDays ?? null,
      max_consecutive_night_shifts: dto.maxConsecutiveNightShifts ?? null,
      min_rest_hours_between_shifts: dto.minRestHoursBetweenShifts ?? null,
      fairness_weight_json: dto.fairnessWeightJson ?? null,
      penalty_weight_json: dto.penaltyWeightJson ?? null,
      attributes: dto.attributes ?? {},
      is_active: dto.isActive ?? true,
    };

    const row = this.repo.create(payload);   
    const saved = await this.repo.save(row); 
    return this.toApi(saved);
  }

  async update(unitId: string, id: string, dto: UpdateConstraintProfileDto) {
    const row = await this.repo.findOne({ where: { id, unit_id: unitId } });
    if (!row) throw new NotFoundException('Constraint profile not found');

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.maxConsecutiveWorkDays !== undefined)
      row.max_consecutive_work_days = dto.maxConsecutiveWorkDays ?? null;
    if (dto.maxConsecutiveNightShifts !== undefined)
      row.max_consecutive_night_shifts = dto.maxConsecutiveNightShifts ?? null;
    if (dto.minRestHoursBetweenShifts !== undefined)
      row.min_rest_hours_between_shifts = dto.minRestHoursBetweenShifts ?? null;
    if (dto.fairnessWeightJson !== undefined)
      row.fairness_weight_json = dto.fairnessWeightJson ?? null;
    if (dto.penaltyWeightJson !== undefined)
      row.penalty_weight_json = dto.penaltyWeightJson ?? null;
    if (dto.attributes !== undefined) row.attributes = dto.attributes ?? {};
    if (dto.isActive !== undefined) row.is_active = dto.isActive;

    const saved = await this.repo.save(row);
    return this.toApi(saved);
  }

  // “activate” = mark one active and optionally deactivate others
  async activate(unitId: string, id: string, deactivateOthers = true) {
    const row = await this.repo.findOne({ where: { id, unit_id: unitId } });
    if (!row) throw new NotFoundException('Constraint profile not found');

    if (deactivateOthers) {
      await this.repo
        .createQueryBuilder()
        .update(ConstraintProfile)
        .set({ is_active: false })
        .where('unit_id = :unitId', { unitId })
        .execute();
    }

    row.is_active = true;
    const saved = await this.repo.save(row);
    return this.toApi(saved);
  }

  private toApi(c: ConstraintProfile) {
    return {
      id: c.id,
      unitId: c.unit_id,
      name: c.name,
      maxConsecutiveWorkDays: c.max_consecutive_work_days,
      maxConsecutiveNightShifts: c.max_consecutive_night_shifts,
      minRestHoursBetweenShifts: c.min_rest_hours_between_shifts,
      fairnessWeightJson: c.fairness_weight_json,
      penaltyWeightJson: c.penalty_weight_json,
      attributes: c.attributes ?? {},
      isActive: c.is_active,
      createdAt: c.created_at,
    };
  }
}
