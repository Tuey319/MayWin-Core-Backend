// src/core/unit-config/coverage-rules/coverage-rules.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { CoverageRule } from '@/database/entities/scheduling/coverage-rule.entity';
import { CoverageRuleItemDto } from './dto/coverage-rule-item.dto';
import { ReplaceCoverageRulesDto } from './dto/replace-coverage-rules.dto';

@Injectable()
export class CoverageRulesService {
  constructor(
    @InjectRepository(CoverageRule)
    private readonly repo: Repository<CoverageRule>,
  ) {}

  async create(unitId: string, dto: CoverageRuleItemDto) {
    const payload: DeepPartial<CoverageRule> = {
      unit_id: unitId,
      shift_code: dto.shiftCode,
      day_type: dto.dayType,
      min_workers: dto.minWorkers ?? null,
      max_workers: dto.maxWorkers ?? null,
      required_tag: dto.requiredTag ?? null,
      attributes: dto.attributes ?? {},
    };

    const row = this.repo.create(payload);     
    const saved = await this.repo.save(row);  
    return this.toApi(saved);
  }

  async update(unitId: string, id: string, dto: CoverageRuleItemDto) {
    const row = await this.repo.findOne({ where: { id, unit_id: unitId } });
    if (!row) throw new NotFoundException('Coverage rule not found');

    row.shift_code = dto.shiftCode;
    row.day_type = dto.dayType;
    row.min_workers = dto.minWorkers ?? null;
    row.max_workers = dto.maxWorkers ?? null;
    row.required_tag = dto.requiredTag ?? null;
    row.attributes = dto.attributes ?? {};

    const saved = await this.repo.save(row);
    return this.toApi(saved);
  }

  async remove(unitId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, unit_id: unitId } });
    if (!row) throw new NotFoundException('Coverage rule not found');
    await this.repo.remove(row);
    return { ok: true };
  }

  // bulk replace = delete old + insert new
  async replace(unitId: string, dto: ReplaceCoverageRulesDto) {
    await this.repo.delete({ unit_id: unitId });

    if (!dto.items?.length) {
      return { unitId, coverageRules: [] };
    }

    // Build *partials* first (not entities) to avoid overload weirdness
    const payloads: DeepPartial<CoverageRule>[] = dto.items.map((it) => ({
      unit_id: unitId,
      shift_code: it.shiftCode,
      day_type: it.dayType,
      min_workers: it.minWorkers ?? null,
      max_workers: it.maxWorkers ?? null,
      required_tag: it.requiredTag ?? null,
      attributes: it.attributes ?? {},
    }));

    // Create entities from partials
    const entities = this.repo.create(payloads);    
    const saved = await this.repo.save(entities);  

    return {
      unitId,
      coverageRules: saved.map((r) => this.toApi(r)),
    };
  }

  private toApi(r: CoverageRule) {
    return {
      id: r.id,
      unitId: r.unit_id,
      shiftCode: r.shift_code,
      dayType: r.day_type,
      minWorkers: r.min_workers,
      maxWorkers: r.max_workers,
      requiredTag: r.required_tag,
      attributes: r.attributes ?? {},
      createdAt: r.created_at,
    };
  }
}
