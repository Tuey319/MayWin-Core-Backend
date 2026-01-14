// src/core/availability/availability.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { WorkerAvailability, AvailabilityType } from '@/database/entities/workers/worker-availability.entity';

type Entry = {
  workerId: string;
  date: string;
  shiftCode: string;
  type: AvailabilityType;
  source?: string;
  reason?: string | null;
  attributes?: Record<string, any>;
};

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(WorkerAvailability)
    private readonly repo: Repository<WorkerAvailability>,
  ) {}

  async get(unitId: string, dateFrom: string, dateTo: string) {
    const rows = await this.repo.find({
      where: { unit_id: unitId, date: Between(dateFrom, dateTo) },
      order: { date: 'ASC' },
    });

    return {
      unitId,
      availability: rows.map((r) => ({
        id: r.id,
        workerId: r.worker_id,
        unitId: r.unit_id,
        date: r.date,
        shiftCode: r.shift_code,
        type: r.type,
        source: r.source,
        reason: r.reason,
        attributes: r.attributes,
      })),
    };
  }

  async upsert(unitId: string, entries: Entry[]) {

    let updatedCount = 0;

    for (const e of entries) {
      const existing = await this.repo.findOne({
        where: {
          unit_id: unitId,
          worker_id: e.workerId,
          date: e.date,
          shift_code: e.shiftCode,
        },
      });

      if (existing) {
        existing.type = e.type;
        existing.source = e.source ?? existing.source;
        existing.reason = e.reason ?? existing.reason;
        existing.attributes = e.attributes ?? existing.attributes;
        await this.repo.save(existing);
      } else {
        const created = this.repo.create({
          unit_id: unitId,
          worker_id: e.workerId,
          date: e.date,
          shift_code: e.shiftCode,
          type: e.type,
          source: e.source ?? 'HEAD_NURSE_UI',
          reason: e.reason ?? null,
          attributes: e.attributes ?? {},
        });
        await this.repo.save(created);
      }

      updatedCount += 1;
    }

    return { unitId, updatedCount };
  }
}
