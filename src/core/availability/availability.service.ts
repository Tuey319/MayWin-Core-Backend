// src/core/availability/availability.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { WorkerAvailability, AvailabilityType } from '@/database/entities/workers/worker-availability.entity';
import { AuditLogsService } from '@/core/audit-logs/audit-logs.service';

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
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async get(unitId: string, dateFrom: string, dateTo: string) {
    const cacheKey = `availability:${unitId}:${dateFrom}:${dateTo}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const rows = await this.repo.find({
      where: { unit_id: unitId, date: Between(dateFrom, dateTo) },
      order: { date: 'ASC' },
    });

    const result = {
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

    await this.cache.set(cacheKey, result, 2 * 60 * 1000); // 2-min TTL — availability changes frequently
    return result;
  }

  async upsert(unitId: string, entries: Entry[], actor?: { actorId: string; actorName: string; orgId?: string }) {
    // Invalidate cache for the date range covered by this upsert
    if (entries.length > 0) {
      const dates = entries.map((e) => e.date).sort();
      const cacheKey = `availability:${unitId}:${dates[0]}:${dates[dates.length - 1]}`;
      await this.cache.del(cacheKey);
    }

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

    // PDPA §27, ISO 27001:2022 A.8.15 — audit log every bulk availability mutation
    if (actor) {
      await this.auditLogs.append({
        orgId: actor.orgId ?? 'unknown',
        actorId: actor.actorId,
        actorName: actor.actorName,
        action: 'UPDATE_AVAILABILITY',
        targetType: 'unit',
        targetId: unitId,
        detail: `Updated ${updatedCount} availability entries`,
      }).catch(() => {});
    }

    return { unitId, updatedCount };
  }
}
