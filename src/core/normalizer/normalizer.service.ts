import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';

import { ScheduleJob } from '@/database/entities/orchestration/schedule-job.entity';
import { CoverageRule } from '@/database/entities/scheduling/coverage-rule.entity';
import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';
import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerUnitMembership } from '@/database/entities/workers/worker-unit.entity';
import { WorkerAvailability } from '@/database/entities/workers/worker-availability.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preference.entity';

export type NormalizedInputV1 = Record<string, any>;

type DayType = 'WEEKDAY' | 'WEEKEND';

type SolverPreferences = Record<string, Record<string, Record<string, number>>>;

@Injectable()
export class NormalizerService {
  constructor(
    @InjectRepository(ScheduleJob)
    private readonly jobsRepo: Repository<ScheduleJob>,

    @InjectRepository(CoverageRule)
    private readonly coverageRepo: Repository<CoverageRule>,

    @InjectRepository(ConstraintProfile)
    private readonly constraintRepo: Repository<ConstraintProfile>,

    @InjectRepository(ShiftTemplate)
    private readonly shiftRepo: Repository<ShiftTemplate>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(WorkerUnitMembership)
    private readonly workerUnitRepo: Repository<WorkerUnitMembership>,

    @InjectRepository(WorkerAvailability)
    private readonly availabilityRepo: Repository<WorkerAvailability>,

    @InjectRepository(WorkerPreference)
    private readonly workerPrefRepo: Repository<WorkerPreference>,
  ) {}

  /**
   * Build solver-ready normalized JSON for a job.
   * Return shape MUST be { payload, meta } to match JobsRunnerService.
   */
  async build(
    jobId: string,
  ): Promise<{ payload: NormalizedInputV1; meta: Record<string, any> }> {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`ScheduleJob not found: ${jobId}`);

    const { organization_id, unit_id, start_date, end_date } = job;

    // Horizon days list (inclusive)
    const days = this.enumerateDatesInclusive(start_date, end_date).map((iso) => ({
      date: iso,
      dayType: this.getDayType(iso),
    }));

    // 1) Shift templates (unit-specific + global (unit_id IS NULL)), active only
    const shiftRows = await this.shiftRepo.find({
      where: [
        { organization_id: organization_id as any, unit_id: unit_id as any, is_active: true } as any,
        { organization_id: organization_id as any, unit_id: IsNull(), is_active: true } as any,
      ],
      order: { code: 'ASC' as any },
    });

    const shifts = shiftRows.map((s) => ({
      code: s.code,
      name: s.name,
      startTime: s.start_time,
      endTime: s.end_time,
      attributes: s.attributes ?? {},
    }));

    // 2) Coverage rules for unit
    const coverageRows = await this.coverageRepo.find({
      where: { unit_id: unit_id as any } as any,
      order: { id: 'ASC' as any },
    });

    const coverageRules = coverageRows.map((r) => ({
      shiftCode: r.shift_code,
      dayType: r.day_type,
      minWorkers: r.min_workers ?? null,
      maxWorkers: r.max_workers ?? null,
      requiredTag: r.required_tag ?? null,
      attributes: r.attributes ?? {},
    }));

    // 3) Constraint profile (job-selected if present, else latest active)
    const constraints = await this.resolveConstraintProfile(job);

    // 4) Workers in this unit (active)
    const memberships = await this.workerUnitRepo.find({
      where: { unit_id: unit_id as any } as any,
    });

    const workerIds = [...new Set(memberships.map((m) => m.worker_id))];

    const workerRows = workerIds.length
      ? await this.workerRepo.find({
          where: {
            id: In(workerIds as any),
            organization_id: organization_id as any,
            is_active: true as any,
          } as any,
          order: { id: 'ASC' as any },
        })
      : [];

    // Deterministic nurseCode per worker
    const nurseCodeByWorkerId: Record<string, string> = {};
    const workerIdByNurseCode: Record<string, string> = {};

    const nurses = workerRows.map((w, idx) => {
      const base =
        (w.worker_code && String(w.worker_code).trim().length > 0
          ? String(w.worker_code).trim()
          : `N${String(idx + 1).padStart(3, '0')}`);

      const code = this.makeUniqueCode(base, workerIdByNurseCode);

      nurseCodeByWorkerId[w.id] = code;
      workerIdByNurseCode[code] = w.id;

      return {
        code,
        fullName: w.full_name,
        employmentType: w.employment_type ?? null,
        weeklyHours: w.weekly_hours ?? null,
        primaryUnitId: w.primary_unit_id ?? null,
        tags: this.extractWorkerTags(w.attributes),
        attributes: w.attributes ?? {},
      };
    });

    // 5) Availability within horizon for this unit + worker set
    const availability = await this.buildAvailability({
      unitId: String(unit_id),
      workerIds: workerRows.map((w) => w.id),
      startDate: start_date,
      endDate: end_date,
      nurseCodeByWorkerId,
    });

    // 5.5) Preferences -> solver "preferences" penalties map
    const preferences = await this.buildSolverPreferences({
      unitId: String(unit_id),
      workerRows,
      days: days.map((d) => String(d.date)),
      shifts,
      nurseCodeByWorkerId,
    });

    // 6) Final normalized payload
    const payload: NormalizedInputV1 = {
      version: 'v1',
      job: {
        jobId: job.id,
        organizationId: String(organization_id),
        unitId: String(unit_id),
        status: job.status,
      },
      horizon: {
        startDate: start_date,
        endDate: end_date,
        days,
      },
      shifts,
      nurses,
      coverageRules,
      constraints,
      availability,
      preferences,

      meta: {
        mappings: {
          nurseCodeByWorkerId,
          workerIdByNurseCode,
        },
        counts: {
          nurses: nurses.length,
          shifts: shifts.length,
          coverageRules: coverageRules.length,
          availabilityRows: availability.length,
          days: days.length,
          preferenceNurses: Object.keys(preferences ?? {}).length,
        },
      },
    };

    return {
      payload,
      meta: payload.meta,
    };
  }

  /* ============================
   * Preferences -> solver penalties
   * ============================ */

  private async buildSolverPreferences(args: {
    unitId: string;
    workerRows: Worker[];
    days: string[];
    shifts: Array<{ code: string; name: string }>;
    nurseCodeByWorkerId: Record<string, string>;
  }): Promise<SolverPreferences> {
    const { unitId, workerRows, days, shifts, nurseCodeByWorkerId } = args;

    if (workerRows.length === 0) return {};

    // pull worker_preferences table rows
    const prefRows = await this.workerPrefRepo.find({
      where: { worker_id: In(workerRows.map((w) => w.id) as any) } as any,
    });

    const prefRowByWorkerId: Record<string, WorkerPreference> = {};
    for (const r of prefRows) prefRowByWorkerId[String(r.worker_id)] = r;

    const nightShiftCodes = this.detectNightShiftCodes(shifts);
    const dayShiftCodes = shifts
      .map((s) => String(s.code))
      .filter((sc) => !nightShiftCodes.has(sc));

    // default penalties
    const PENALTY_DISLIKED = 5;

    const out: SolverPreferences = {};

    for (const w of workerRows) {
      const workerId = String(w.id);
      const nurseCode = nurseCodeByWorkerId[workerId];
      if (!nurseCode) continue;

      const rowPref = prefRowByWorkerId[workerId] ?? null;
      const attrPref = this.readAttrPreferencesForUnit(w, unitId);

      // Merge (DB row wins if set, else fallback to attributes)
      const prefersDay =
        (rowPref?.prefers_day_shifts ?? null) ??
        (attrPref?.prefers_day_shifts ?? attrPref?.prefersDayShifts ?? null);

      const prefersNight =
        (rowPref?.prefers_night_shifts ?? null) ??
        (attrPref?.prefers_night_shifts ?? attrPref?.prefersNightShifts ?? null);

      const patternJson =
        (rowPref?.preference_pattern_json ?? null) ??
        (attrPref?.preference_pattern_json ?? attrPref?.preferencePatternJson ?? null);

      // 1) Start empty
      out[nurseCode] = {};

      // 2) Apply explicit per-day/per-shift penalties if provided (patternJson)
      const explicit = this.normalizePatternPenalties(patternJson);
      if (explicit) {
        for (const d of Object.keys(explicit)) {
          const byShift = explicit[d];
          if (!byShift || typeof byShift !== 'object') continue;
          out[nurseCode][d] = out[nurseCode][d] ?? {};
          for (const sc of Object.keys(byShift)) {
            const val = Number((byShift as any)[sc]);
            if (!Number.isFinite(val)) continue;
            if (val <= 0) continue;
            out[nurseCode][d][sc] = Math.trunc(val);
          }
        }
      }

      // 3) Apply coarse preferences (prefers day vs night) across the whole horizon
      // If prefersDay=true => penalize night shifts
      // If prefersNight=true => penalize day shifts
      if (prefersDay === true) {
        for (const d of days) {
          out[nurseCode][d] = out[nurseCode][d] ?? {};
          for (const sc of nightShiftCodes) {
            if (out[nurseCode][d][sc] == null) out[nurseCode][d][sc] = PENALTY_DISLIKED;
          }
        }
      }

      if (prefersNight === true) {
        for (const d of days) {
          out[nurseCode][d] = out[nurseCode][d] ?? {};
          for (const sc of dayShiftCodes) {
            if (out[nurseCode][d][sc] == null) out[nurseCode][d][sc] = PENALTY_DISLIKED;
          }
        }
      }

      // 4) Clean: if nurse has no penalties at all, remove to keep payload compact
      if (!this.hasAnyPenalty(out[nurseCode])) {
        delete out[nurseCode];
      }
    }

    return out;
  }

  private readAttrPreferencesForUnit(worker: Worker, unitId: string): Record<string, any> | null {
    const attrs = (worker.attributes ?? {}) as Record<string, any>;
    const prefRoot = (attrs.preferences ?? {}) as Record<string, any>;
    const byUnit = (prefRoot.preferencesByUnit ?? {}) as Record<string, any>;
    const p = byUnit[String(unitId)] ?? null;
    return p && typeof p === 'object' ? p : null;
  }

  private normalizePatternPenalties(patternJson: any): Record<string, Record<string, number>> | null {
    if (!patternJson || typeof patternJson !== 'object') return null;

    const maybe = (patternJson.penalties && typeof patternJson.penalties === 'object')
      ? patternJson.penalties
      : patternJson;

    const out: Record<string, Record<string, number>> = {};
    for (const k of Object.keys(maybe)) {
      const v = (maybe as any)[k];
      if (!v || typeof v !== 'object') continue;
      out[String(k)] = v as Record<string, number>;
    }
    return Object.keys(out).length ? out : null;
  }

  private detectNightShiftCodes(shifts: Array<{ code: string; name: string }>): Set<string> {
    const night = new Set<string>();
    for (const s of shifts) {
      const code = String(s.code);
      const name = String((s as any).name ?? '');

      const c = code.trim().toLowerCase();
      const n = name.trim().toLowerCase();

      // Heuristics:
      // - code "N" is night in your current examples
      // - name contains "night"
      // - code contains "night"
      if (c === 'n' || c.includes('night') || n.includes('night')) {
        night.add(code);
      }
    }
    return night;
  }

  private hasAnyPenalty(dayMap: Record<string, Record<string, number>>): boolean {
    for (const d of Object.keys(dayMap)) {
      const sMap = dayMap[d];
      if (!sMap) continue;
      for (const sc of Object.keys(sMap)) {
        const v = Number(sMap[sc]);
        if (Number.isFinite(v) && v > 0) return true;
      }
    }
    return false;
  }

  /* ============================
   * Helpers (existing)
   * ============================ */

  private enumerateDatesInclusive(startIso: string, endIso: string): string[] {
    const start = new Date(`${startIso}T00:00:00.000Z`);
    const end = new Date(`${endIso}T00:00:00.000Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error(`Invalid horizon: start=${startIso} end=${endIso}`);
    }

    const out: string[] = [];
    const cur = new Date(start);

    while (cur.getTime() <= end.getTime()) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }

  private getDayType(dateIso: string): DayType {
    const d = new Date(`${dateIso}T00:00:00.000Z`);
    const dow = d.getUTCDay();
    return dow === 0 || dow === 6 ? 'WEEKEND' : 'WEEKDAY';
  }

  private makeUniqueCode(base: string, used: Record<string, string>): string {
    let code = base;
    let i = 2;
    while (used[code]) {
      code = `${base}_${i}`;
      i += 1;
    }
    return code;
  }

  private extractWorkerTags(attributes: Record<string, any> | null | undefined): string[] {
    const a = attributes ?? {};
    const tags: string[] = [];

    if (Array.isArray(a.tags)) tags.push(...a.tags.map(String));
    if (Array.isArray(a.skills)) tags.push(...a.skills.map(String));

    return [...new Set(tags)].filter((t) => t.trim().length > 0);
  }

  private async resolveConstraintProfile(job: ScheduleJob): Promise<Record<string, any>> {
    const cpId = job.attributes?.constraintProfileId ?? job.attributes?.constraint_profile_id ?? null;

    let cp: ConstraintProfile | null = null;

    if (cpId) {
      cp = await this.constraintRepo.findOne({
        where: { id: String(cpId) as any, unit_id: job.unit_id as any } as any,
      });
    }

    if (!cp) {
      cp = await this.constraintRepo.findOne({
        where: { unit_id: job.unit_id as any, is_active: true as any } as any,
        order: { created_at: 'DESC' as any },
      });
    }

    return {
      constraintProfileId: cp?.id ?? null,
      name: cp?.name ?? 'DEFAULT',
      maxConsecutiveWorkDays: cp?.max_consecutive_work_days ?? null,
      maxConsecutiveNightShifts: cp?.max_consecutive_night_shifts ?? null,
      minRestHoursBetweenShifts: cp?.min_rest_hours_between_shifts ?? null,
      fairnessWeightJson: cp?.fairness_weight_json ?? null,
      penaltyWeightJson: cp?.penalty_weight_json ?? null,
      attributes: cp?.attributes ?? {},
    };
  }

  private async buildAvailability(args: {
    unitId: string;
    workerIds: string[];
    startDate: string;
    endDate: string;
    nurseCodeByWorkerId: Record<string, string>;
  }): Promise<Array<Record<string, any>>> {
    const { unitId, workerIds, startDate, endDate, nurseCodeByWorkerId } = args;

    if (workerIds.length === 0) return [];

    const rows = await this.availabilityRepo.find({
      where: {
        unit_id: unitId as any,
        worker_id: In(workerIds as any),
        date: Between(startDate as any, endDate as any),
      } as any,
      order: { date: 'ASC' as any, worker_id: 'ASC' as any },
    });

    return rows.map((r) => ({
      nurseCode: nurseCodeByWorkerId[r.worker_id] ?? null,
      workerId: String(r.worker_id),
      date: r.date,
      shiftCode: r.shift_code,
      type: r.type,
      source: r.source,
      reason: r.reason ?? null,
      attributes: r.attributes ?? {},
    }));
  }
}
