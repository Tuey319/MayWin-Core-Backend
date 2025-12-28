// src/core/unit-config/unit-config.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';
import { CoverageRule } from '@/database/entities/scheduling/coverage-rule.entity';

export type UnitConfigShiftTemplate = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  attributes: Record<string, any>;
};

export type UnitConfigConstraintProfile = {
  id: string;
  name: string;
  maxConsecutiveWorkDays: number | null;
  maxConsecutiveNightShifts: number | null;
  minRestHoursBetweenShifts: number | null;
  fairnessWeightJson: Record<string, any> | null;
  penaltyWeightJson: Record<string, any> | null;
  attributes: Record<string, any>;
};

export type UnitConfigCoverageRule = {
  id: string;
  shiftCode: string;
  dayType: string;
  minWorkers: number | null;
  maxWorkers: number | null;
  requiredTag: string | null;
  attributes: Record<string, any>;
};

@Injectable()
export class UnitConfigService {
  constructor(
    @InjectRepository(ShiftTemplate)
    private readonly shiftTemplatesRepo: Repository<ShiftTemplate>,

    @InjectRepository(ConstraintProfile)
    private readonly constraintProfilesRepo: Repository<ConstraintProfile>,

    @InjectRepository(CoverageRule)
    private readonly coverageRulesRepo: Repository<CoverageRule>,
  ) {}

  async getFullUnitConfig(unitId: string) {
    const [shiftTemplatesResp, constraintProfilesResp, coverageRulesResp] =
      await Promise.all([
        this.getShiftTemplates(unitId),
        this.getConstraintProfiles(unitId),
        this.getCoverageRules(unitId),
      ]);

    return {
      unitId,
      shiftTemplates: shiftTemplatesResp.shiftTemplates,
      constraintProfiles: constraintProfilesResp.constraintProfiles,
      coverageRules: coverageRulesResp.coverageRules,
    };
  }

  async getShiftTemplates(unitId: string): Promise<{
    unitId: string;
    shiftTemplates: UnitConfigShiftTemplate[];
  }> {
    // include:
    // - unit-specific templates (unit_id = unitId)
    // - org-wide templates (unit_id IS NULL)
    // return only active templates
    const rows = await this.shiftTemplatesRepo.find({
      where: [
        { unit_id: unitId, is_active: true } as any,
        { unit_id: IsNull(), is_active: true } as any,
      ],
      order: { code: 'ASC' as any },
    });

    return {
      unitId,
      shiftTemplates: rows.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        startTime: s.start_time,
        endTime: s.end_time,
        attributes: s.attributes ?? {},
      })),
    };
  }

  async getConstraintProfiles(unitId: string): Promise<{
    unitId: string;
    constraintProfiles: UnitConfigConstraintProfile[];
  }> {
    const rows = await this.constraintProfilesRepo.find({
      where: { unit_id: unitId, is_active: true } as any,
      order: { created_at: 'DESC' as any },
    });

    return {
      unitId,
      constraintProfiles: rows.map((c) => ({
        id: c.id,
        name: c.name,
        maxConsecutiveWorkDays: c.max_consecutive_work_days ?? null,
        maxConsecutiveNightShifts: c.max_consecutive_night_shifts ?? null,
        minRestHoursBetweenShifts: c.min_rest_hours_between_shifts ?? null,
        fairnessWeightJson: c.fairness_weight_json ?? null,
        penaltyWeightJson: c.penalty_weight_json ?? null,
        attributes: c.attributes ?? {},
      })),
    };
  }

  async getCoverageRules(unitId: string): Promise<{
    unitId: string;
    coverageRules: UnitConfigCoverageRule[];
  }> {
    const rows = await this.coverageRulesRepo.find({
      where: { unit_id: unitId } as any,
      order: { created_at: 'ASC' as any },
    });

    return {
      unitId,
      coverageRules: rows.map((r) => ({
        id: r.id,
        shiftCode: r.shift_code,
        dayType: r.day_type,
        minWorkers: r.min_workers ?? null,
        maxWorkers: r.max_workers ?? null,
        requiredTag: r.required_tag ?? null,
        attributes: r.attributes ?? {},
      })),
    };
  }
}
