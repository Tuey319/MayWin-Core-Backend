// src/core/unit-config/constraint-profiles/constraint-profiles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';
import { Unit } from '@/database/entities/core/unit.entity';
import { CreateConstraintProfileDto } from './dto/create-constraint-profile.dto';
import { UpdateConstraintProfileDto } from './dto/update-constraint-profile.dto';

@Injectable()
export class ConstraintProfilesService {
  constructor(
    @InjectRepository(ConstraintProfile)
    private readonly repo: Repository<ConstraintProfile>,
  ) {}

  async create(unitId: string, dto: CreateConstraintProfileDto) {
    const row = this.repo.create(this.toPayload(dto, { unit_id: unitId, org_id: null }));
    return { profile: this.toApi(await this.repo.save(row)) };
  }

  async update(unitId: string, id: string, dto: UpdateConstraintProfileDto) {
    const row = await this.repo.findOne({ where: { id, unit_id: unitId } as any });
    if (!row) throw new NotFoundException('Constraint profile not found');
    this.applyUpdate(row, dto);
    return { profile: this.toApi(await this.repo.save(row)) };
  }

  async listByUnit(unitId: string) {
    const rows = await this.repo.find({
      where: { unit_id: unitId as any } as any,
      order: { created_at: 'ASC' as any },
    });
    return { profiles: rows.map((r) => this.toApi(r)) };
  }

  async activate(unitId: string, id: string, deactivateOthers = true) {
    const row = await this.repo.findOne({ where: { id, unit_id: unitId } as any });
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
    return { profile: this.toApi(await this.repo.save(row)) };
  }

  async listAll() {
    const rows = await this.repo.find({ order: { created_at: 'ASC' as any } });
    return { profiles: rows.map((r) => this.toApi(r)) };
  }

  async listByOrg(orgId: string) {
    const rows = await this.repo
      .createQueryBuilder('cp')
      .leftJoin(Unit, 'u', 'u.id = cp.unit_id')
      .where('cp.org_id = :orgId OR u.organization_id = :orgId', { orgId })
      .orderBy('cp.created_at', 'ASC')
      .getMany();
    return { profiles: rows.map((r) => this.toApi(r)) };
  }

  async createForOrg(orgId: string, dto: CreateConstraintProfileDto) {
    const row = this.repo.create(this.toPayload(dto, { org_id: orgId, unit_id: null }));
    return { profile: this.toApi(await this.repo.save(row)) };
  }

  async updateForOrg(orgId: string, id: string, dto: UpdateConstraintProfileDto) {
    const row = await this.repo.findOne({ where: { id, org_id: orgId } as any });
    if (!row) throw new NotFoundException('Constraint profile not found');
    this.applyUpdate(row, dto);
    return { profile: this.toApi(await this.repo.save(row)) };
  }

  async deleteForOrg(orgId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, org_id: orgId } as any });
    if (!row) throw new NotFoundException('Constraint profile not found');
    await this.repo.remove(row);
    return { ok: true };
  }

  private readAdvancedSolverOptions(source: Record<string, any> | null | undefined) {
    const attrs = source ?? {};
    const read = <T>(camelKey: string, snakeKey: string, fallback: T): T => {
      const value = attrs[camelKey] ?? attrs[snakeKey];
      return value === undefined ? fallback : (value as T);
    };

    return {
      enableShiftTypeLimit: read('enableShiftTypeLimit', 'enable_shift_type_limit', true),
      maxShiftPerType: read<Record<string, number>>(
        'maxShiftPerType',
        'max_shift_per_type',
        { morning: 9, evening: 9, night: 9 },
      ),
      shiftTypeLimitExemptNurses: read<string[]>(
        'shiftTypeLimitExemptNurses',
        'shift_type_limit_exempt_nurses',
        [],
      ),
      eveningAfterMorningCountsAsOvertime: read(
        'eveningAfterMorningCountsAsOvertime',
        'evening_after_morning_counts_as_overtime',
        true,
      ),
      enableConsecutiveNightLimit: read(
        'enableConsecutiveNightLimit',
        'enable_consecutive_night_limit',
        true,
      ),
      enableMinTotalDaysOff: read('enableMinTotalDaysOff', 'enable_min_total_days_off', true),
      minTotalDaysOff: read('minTotalDaysOff', 'min_total_days_off', 11),
    };
  }

  private writeAdvancedSolverOptions(
    base: Record<string, any>,
    dto: Partial<CreateConstraintProfileDto | UpdateConstraintProfileDto>,
  ) {
    const next = { ...base };
    const set = (key: string, value: any) => {
      if (value !== undefined) next[key] = value;
    };

    set('enableShiftTypeLimit', dto.enableShiftTypeLimit);
    set('maxShiftPerType', dto.maxShiftPerType);
    set('shiftTypeLimitExemptNurses', dto.shiftTypeLimitExemptNurses);
    set('eveningAfterMorningCountsAsOvertime', dto.eveningAfterMorningCountsAsOvertime);
    set('enableConsecutiveNightLimit', dto.enableConsecutiveNightLimit);
    set('enableMinTotalDaysOff', dto.enableMinTotalDaysOff);
    set('minTotalDaysOff', dto.minTotalDaysOff);

    return next;
  }

  private hasAdvancedUpdate(dto: Partial<CreateConstraintProfileDto | UpdateConstraintProfileDto>) {
    return (
      dto.enableShiftTypeLimit !== undefined ||
      dto.maxShiftPerType !== undefined ||
      dto.shiftTypeLimitExemptNurses !== undefined ||
      dto.eveningAfterMorningCountsAsOvertime !== undefined ||
      dto.enableConsecutiveNightLimit !== undefined ||
      dto.enableMinTotalDaysOff !== undefined ||
      dto.minTotalDaysOff !== undefined
    );
  }

  private buildAttributes(
    dto: Partial<CreateConstraintProfileDto | UpdateConstraintProfileDto>,
    existing: Record<string, any> | null | undefined = null,
  ): Record<string, any> {
    const base = { ...(existing ?? {}) };

    if (dto.attributes !== undefined) {
      Object.assign(base, dto.attributes ?? {});
    }

    return this.writeAdvancedSolverOptions(base, dto);
  }

  private toPayload(
    dto: CreateConstraintProfileDto,
    scope: { unit_id: string | null; org_id: string | null },
  ): DeepPartial<ConstraintProfile> {
    const attributes = this.buildAttributes(dto, {});

    return {
      ...scope,
      name: dto.name,
      description: dto.description ?? null,
      assigned_to: dto.assignedTo ?? null,
      color: dto.color ?? 'primary',
      max_consecutive_work_days: dto.maxConsecutiveWorkDays ?? null,
      max_consecutive_night_shifts: dto.maxConsecutiveNightShifts ?? null,
      min_rest_hours_between_shifts: dto.minRestHoursBetweenShifts ?? null,
      max_shifts_per_day: dto.maxShiftsPerDay ?? 1,
      min_days_off_per_week: dto.minDaysOffPerWeek ?? 2,
      max_nights_per_week: dto.maxNightsPerWeek ?? 2,
      forbid_night_to_morning: dto.forbidNightToMorning ?? true,
      forbid_morning_to_night_same_day: dto.forbidMorningToNightSameDay ?? false,
      forbid_evening_to_night: dto.forbidEveningToNight ?? true,
      guarantee_full_coverage: dto.guaranteeFullCoverage ?? true,
      allow_emergency_overrides: dto.allowEmergencyOverrides ?? true,
      allow_second_shift_same_day_in_emergency: dto.allowSecondShiftSameDayInEmergency ?? true,
      ignore_availability_in_emergency: dto.ignoreAvailabilityInEmergency ?? false,
      allow_night_cap_override_in_emergency: dto.allowNightCapOverrideInEmergency ?? true,
      allow_rest_rule_override_in_emergency: dto.allowRestRuleOverrideInEmergency ?? true,
      goal_minimize_staff_cost: dto.goalMinimizeStaffCost ?? true,
      goal_maximize_preference_satisfaction: dto.goalMaximizePreferenceSatisfaction ?? true,
      goal_balance_workload: dto.goalBalanceWorkload ?? false,
      goal_balance_night_workload: dto.goalBalanceNightWorkload ?? false,
      goal_reduce_undesirable_shifts: dto.goalReduceUndesirableShifts ?? true,
      penalty_weight_json: dto.penaltyWeightJson ?? null,
      fairness_weight_json: dto.fairnessWeightJson ?? null,
      goal_priority_json: dto.goalPriorityJson ?? null,
      num_search_workers: dto.numSearchWorkers ?? 8,
      time_limit_sec: dto.timeLimitSec ?? 20,
      attributes,
      is_active: dto.isActive ?? true,
    };
  }

  private applyUpdate(row: ConstraintProfile, dto: UpdateConstraintProfileDto) {
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description ?? null;
    if (dto.assignedTo !== undefined) row.assigned_to = dto.assignedTo ?? null;
    if (dto.color !== undefined) row.color = dto.color;
    if (dto.maxConsecutiveWorkDays !== undefined) row.max_consecutive_work_days = dto.maxConsecutiveWorkDays ?? null;
    if (dto.maxConsecutiveNightShifts !== undefined) row.max_consecutive_night_shifts = dto.maxConsecutiveNightShifts ?? null;
    if (dto.minRestHoursBetweenShifts !== undefined) row.min_rest_hours_between_shifts = dto.minRestHoursBetweenShifts ?? null;
    if (dto.maxShiftsPerDay !== undefined) row.max_shifts_per_day = dto.maxShiftsPerDay;
    if (dto.minDaysOffPerWeek !== undefined) row.min_days_off_per_week = dto.minDaysOffPerWeek;
    if (dto.maxNightsPerWeek !== undefined) row.max_nights_per_week = dto.maxNightsPerWeek;
    if (dto.forbidNightToMorning !== undefined) row.forbid_night_to_morning = dto.forbidNightToMorning;
    if (dto.forbidMorningToNightSameDay !== undefined) row.forbid_morning_to_night_same_day = dto.forbidMorningToNightSameDay;
    if (dto.forbidEveningToNight !== undefined) row.forbid_evening_to_night = dto.forbidEveningToNight;
    if (dto.guaranteeFullCoverage !== undefined) row.guarantee_full_coverage = dto.guaranteeFullCoverage;
    if (dto.allowEmergencyOverrides !== undefined) row.allow_emergency_overrides = dto.allowEmergencyOverrides;
    if (dto.allowSecondShiftSameDayInEmergency !== undefined) row.allow_second_shift_same_day_in_emergency = dto.allowSecondShiftSameDayInEmergency;
    if (dto.ignoreAvailabilityInEmergency !== undefined) row.ignore_availability_in_emergency = dto.ignoreAvailabilityInEmergency;
    if (dto.allowNightCapOverrideInEmergency !== undefined) row.allow_night_cap_override_in_emergency = dto.allowNightCapOverrideInEmergency;
    if (dto.allowRestRuleOverrideInEmergency !== undefined) row.allow_rest_rule_override_in_emergency = dto.allowRestRuleOverrideInEmergency;
    if (dto.goalMinimizeStaffCost !== undefined) row.goal_minimize_staff_cost = dto.goalMinimizeStaffCost;
    if (dto.goalMaximizePreferenceSatisfaction !== undefined) row.goal_maximize_preference_satisfaction = dto.goalMaximizePreferenceSatisfaction;
    if (dto.goalBalanceWorkload !== undefined) row.goal_balance_workload = dto.goalBalanceWorkload;
    if (dto.goalBalanceNightWorkload !== undefined) row.goal_balance_night_workload = dto.goalBalanceNightWorkload;
    if (dto.goalReduceUndesirableShifts !== undefined) row.goal_reduce_undesirable_shifts = dto.goalReduceUndesirableShifts;
    if (dto.penaltyWeightJson !== undefined) row.penalty_weight_json = dto.penaltyWeightJson ?? null;
    if (dto.fairnessWeightJson !== undefined) row.fairness_weight_json = dto.fairnessWeightJson ?? null;
    if (dto.goalPriorityJson !== undefined) row.goal_priority_json = dto.goalPriorityJson ?? null;
    if (dto.numSearchWorkers !== undefined) row.num_search_workers = dto.numSearchWorkers;
    if (dto.timeLimitSec !== undefined) row.time_limit_sec = dto.timeLimitSec;
    if (dto.attributes !== undefined || this.hasAdvancedUpdate(dto)) {
      row.attributes = this.buildAttributes(dto, row.attributes ?? {});
    }
    if (dto.isActive !== undefined) row.is_active = dto.isActive;
  }

  private toApi(c: ConstraintProfile) {
    const advanced = this.readAdvancedSolverOptions(c.attributes ?? {});

    return {
      id: c.id,
      unitId: c.unit_id,
      orgId: c.org_id,
      name: c.name,
      description: c.description ?? null,
      assignedTo: c.assigned_to ?? null,
      color: c.color ?? 'primary',
      maxConsecutiveWorkDays: c.max_consecutive_work_days,
      maxConsecutiveNightShifts: c.max_consecutive_night_shifts,
      minRestHoursBetweenShifts: c.min_rest_hours_between_shifts,
      maxShiftsPerDay: c.max_shifts_per_day,
      minDaysOffPerWeek: c.min_days_off_per_week,
      maxNightsPerWeek: c.max_nights_per_week,
      forbidNightToMorning: c.forbid_night_to_morning,
      forbidMorningToNightSameDay: c.forbid_morning_to_night_same_day,
      forbidEveningToNight: c.forbid_evening_to_night,
      guaranteeFullCoverage: c.guarantee_full_coverage,
      allowEmergencyOverrides: c.allow_emergency_overrides,
      allowSecondShiftSameDayInEmergency: c.allow_second_shift_same_day_in_emergency,
      ignoreAvailabilityInEmergency: c.ignore_availability_in_emergency,
      allowNightCapOverrideInEmergency: c.allow_night_cap_override_in_emergency,
      allowRestRuleOverrideInEmergency: c.allow_rest_rule_override_in_emergency,
      goalMinimizeStaffCost: c.goal_minimize_staff_cost,
      goalMaximizePreferenceSatisfaction: c.goal_maximize_preference_satisfaction,
      goalBalanceWorkload: c.goal_balance_workload,
      goalBalanceNightWorkload: c.goal_balance_night_workload,
      goalReduceUndesirableShifts: c.goal_reduce_undesirable_shifts,
      enableShiftTypeLimit: advanced.enableShiftTypeLimit,
      maxShiftPerType: advanced.maxShiftPerType,
      shiftTypeLimitExemptNurses: advanced.shiftTypeLimitExemptNurses,
      eveningAfterMorningCountsAsOvertime: advanced.eveningAfterMorningCountsAsOvertime,
      enableConsecutiveNightLimit: advanced.enableConsecutiveNightLimit,
      enableMinTotalDaysOff: advanced.enableMinTotalDaysOff,
      minTotalDaysOff: advanced.minTotalDaysOff,
      penaltyWeightJson: c.penalty_weight_json,
      fairnessWeightJson: c.fairness_weight_json,
      goalPriorityJson: c.goal_priority_json,
      numSearchWorkers: c.num_search_workers,
      timeLimitSec: c.time_limit_sec,
      attributes: c.attributes ?? {},
      isActive: c.is_active,
      createdAt: c.created_at,
    };
  }
}
