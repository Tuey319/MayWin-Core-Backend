// src/core/worker-preferences/worker-preferences.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preferences.entity';
import { WorkerAvailability, AvailabilityType } from '@/database/entities/workers/worker-availability.entity';
import { WorkerPreferencesDto } from './dto/put-worker-preferences.dto';

type JwtCtx = {
  organizationId: number;
  roles: string[];
  unitIds: number[];
};

@Injectable()
export class WorkerPreferencesService {
  constructor(
    @InjectRepository(Worker)
    private readonly workersRepo: Repository<Worker>,

    @InjectRepository(WorkerUnitMembership)
    private readonly membershipRepo: Repository<WorkerUnitMembership>,

    @InjectRepository(WorkerPreference)
    private readonly preferencesRepo: Repository<WorkerPreference>,

    @InjectRepository(WorkerAvailability)
    private readonly workerAvailabilityRepo: Repository<WorkerAvailability>,
  ) {}

  /**
   * DB role codes are: ADMIN / MANAGER / SCHEDULER / VIEWER
   * - ADMIN + MANAGER: can see all units
   * - others: restricted to ctx.unitIds
   */
  private canSeeAllUnits(ctx: JwtCtx) {
    const roles = ctx.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MANAGER');
  }

  private assertCanAccessUnit(ctx: JwtCtx, unitId: string) {
    if (this.canSeeAllUnits(ctx)) return;
    const allowed = new Set((ctx.unitIds ?? []).map((x) => Number(x)));
    if (!allowed.has(Number(unitId))) {
      throw new ForbiddenException('Forbidden: unit not in token context');
    }
  }

  /**
   * Dashboard / admin list:
   * Get all workers in a unit + their stored preferences from maywin_db.worker_preferences.
   *
   * NOTE:
   * Preferences are per-worker (table has no unit_id), so we return the same pref row regardless of unit.
   */
  async listForUnit(ctx: JwtCtx, unitId: string) {
    this.assertCanAccessUnit(ctx, unitId);

    // 1) Get memberships for this unit
    const memberships = await this.membershipRepo.find({
      where: { unit_id: unitId as any },
    });

    const workerIds = memberships.map((m) => Number(m.worker_id));
    if (!workerIds.length) {
      return {
        unitId: String(unitId),
        totalWorkers: 0,
        preferencesSubmittedThisMonth: 0,
        items: [],
      };
    }

    // 2) Fetch workers (restrict to org + active)
    const workers = await this.workersRepo
      .createQueryBuilder('w')
      .where('w.organization_id = :orgId', { orgId: String(ctx.organizationId) })
      .andWhere('w.is_active = true')
      .andWhere('w.id IN (:...ids)', { ids: workerIds.map(String) })
      .orderBy('w.full_name', 'ASC')
      .getMany();

    // 3) Fetch preferences in bulk from worker_preferences
    const prefRows = await this.preferencesRepo.find({
      where: { worker_id: In(workerIds) as any },
    });

    const prefByWorkerId = new Map<number, WorkerPreference>();
    for (const p of prefRows) {
      prefByWorkerId.set(Number((p as any).worker_id), p);
    }

    // 4) Submitted this month based on worker_preferences.updated_at
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 5) Fetch days off for all workers in this unit
    const daysOffRows = await this.workerAvailabilityRepo.find({
      where: {
        worker_id: In(workerIds) as any,
        unit_id: unitId as any,
        type: AvailabilityType.DAY_OFF,
      },
    });
    const daysOffByWorkerId = new Map<string, any[]>();
    for (const row of daysOffRows) {
      const wid = String(row.worker_id);
      if (!daysOffByWorkerId.has(wid)) daysOffByWorkerId.set(wid, []);
      daysOffByWorkerId.get(wid)!.push({
        date: row.date,
        shiftCode: row.shift_code,
        reason: row.reason,
        attributes: row.attributes,
      });
    }

    let submittedThisMonth = 0;

    const items = workers.map((w) => {

      const pref = prefByWorkerId.get(Number(w.id)) ?? null;
      // Prefer days_off_pattern_json if present, else fallback to worker_availability
      let daysOff = [];
      if (pref && pref.days_off_pattern_json && Object.keys(pref.days_off_pattern_json).length > 0) {
        daysOff = Object.entries(pref.days_off_pattern_json).map(([date, value]) => ({ date, ...value }));
      } else {
        daysOff = daysOffByWorkerId.get(String(w.id)) ?? [];
      }

      if (pref && (pref as any).updated_at && new Date((pref as any).updated_at) >= monthStart) {
        submittedThisMonth += 1;
      }

      return {
        worker: {
          id: String(w.id),
          fullName: w.full_name,
          workerCode: w.worker_code,
          employmentType: w.employment_type,
          weeklyHours: w.weekly_hours,
          primaryUnitId: w.primary_unit_id,
          attributes: (w.attributes ?? {}) as Record<string, any>,
          isActive: w.is_active,
          createdAt: w.created_at,
          updatedAt: w.updated_at,
        },
        unitId: String(unitId),
        preferences: pref,
        daysOff,
      };
    });

    return {
      unitId: String(unitId),
      totalWorkers: items.length,
      preferencesSubmittedThisMonth: submittedThisMonth,
      items,
    };
  }

  async getPreferences(workerId: string) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker || !worker.is_active) throw new NotFoundException('Worker not found');

    const pref = await this.preferencesRepo.findOne({
      where: { worker_id: Number(workerId) as any },
    });

    // ✅ return the DB row; if not present, return null (or {} if you prefer)
    return {
      workerId: worker.id,
      preferences: pref ?? null,
    };
  }

  async deletePreferences(workerId: string) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker || !worker.is_active) throw new NotFoundException('Worker not found');

    const existing = await this.preferencesRepo.findOne({
      where: { worker_id: Number(workerId) as any },
    });
    if (!existing) throw new NotFoundException('No preferences found for this worker');

    await this.preferencesRepo.delete({ worker_id: Number(workerId) as any });
    return { workerId, deleted: true };
  }

  async deletePreferenceRequest(workerId: string, date: string) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker || !worker.is_active) throw new NotFoundException('Worker not found');

    const existing = await this.preferencesRepo.findOne({
      where: { worker_id: Number(workerId) as any },
    });
    if (!existing) throw new NotFoundException('No preferences found for this worker');

    const pattern = { ...(existing.preference_pattern_json ?? {}) };
    if (!(date in pattern)) throw new NotFoundException(`No request found for date ${date}`);

    delete pattern[date];
    await this.preferencesRepo.save({ ...existing, preference_pattern_json: pattern } as any);
    return { workerId, deletedDate: date, remaining: Object.keys(pattern).length };
  }

  async upsertPreferences(workerId: string, _unitId: string, preferences: WorkerPreferencesDto) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker || !worker.is_active) throw new NotFoundException('Worker not found');

    // Find existing preferences row by worker_id
    const existing = await this.preferencesRepo.findOne({
      where: { worker_id: Number(workerId) as any },
    });

    // Merge new requests with existing preferences
    let mergedPreferencePattern = {};
    let mergedDaysOffPattern = {};
    if (existing) {
      mergedPreferencePattern = { ...(existing.preference_pattern_json || {}), ...((preferences as any).preferencePatternJson || (preferences as any).preference_pattern_json || {}) };
      mergedDaysOffPattern = { ...(existing.days_off_pattern_json || {}), ...((preferences as any).daysOffPatternJson || (preferences as any).days_off_pattern_json || {}) };
    } else {
      mergedPreferencePattern = (preferences as any).preferencePatternJson || (preferences as any).preference_pattern_json || {};
      mergedDaysOffPattern = (preferences as any).daysOffPatternJson || (preferences as any).days_off_pattern_json || {};
    }
    const patch: Partial<WorkerPreference> = {
      worker_id: Number(workerId) as any,
      prefers_day_shifts: (preferences as any).prefersDayShifts ?? (preferences as any).prefers_day_shifts ?? null,
      prefers_night_shifts: (preferences as any).prefersNightShifts ?? (preferences as any).prefers_night_shifts ?? null,
      max_consecutive_work_days:
        (preferences as any).maxConsecutiveWorkDays ?? (preferences as any).max_consecutive_work_days ?? null,
      max_consecutive_night_shifts:
        (preferences as any).maxConsecutiveNightShifts ?? (preferences as any).max_consecutive_night_shifts ?? null,
      preference_pattern_json: mergedPreferencePattern,
      days_off_pattern_json: mergedDaysOffPattern,
      attributes: (preferences as any).attributes ?? null,
    } as any;

    const saved = await this.preferencesRepo.save(
      existing ? ({ ...existing, ...patch } as any) : (this.preferencesRepo.create(patch as any) as any),
    );

    // Note: Scheduling engine job creation would require a valid scheduleId
    // which is not available in the preferences update context.
    // Job creation should be triggered from the schedule/orchestrator module instead.

    return {
      workerId: String(worker.id),
      preferences: saved,
      updatedAt: (saved as any).updated_at ? new Date((saved as any).updated_at).toISOString() : new Date().toISOString(),
    };
  }
}
