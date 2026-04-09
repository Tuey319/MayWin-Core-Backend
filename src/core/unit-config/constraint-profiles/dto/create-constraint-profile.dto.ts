// src/core/unit-config/constraint-profiles/dto/create-constraint-profile.dto.ts
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateConstraintProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  // ── UI display fields ──────────────────────────────────────────────────────

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['primary', 'warning', 'success'])
  color?: string;

  // ── sequence / rest ────────────────────────────────────────────────────────

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutiveWorkDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutiveNightShifts?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  minRestHoursBetweenShifts?: number | null;

  // ── daily / weekly limits ──────────────────────────────────────────────────

  @IsOptional()
  @IsInt()
  @Min(1)
  maxShiftsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDaysOffPerWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxNightsPerWeek?: number;

  // ── shift-sequence toggles ─────────────────────────────────────────────────

  @IsOptional()
  @IsBoolean()
  forbidNightToMorning?: boolean;

  @IsOptional()
  @IsBoolean()
  forbidMorningToNightSameDay?: boolean;

  @IsOptional()
  @IsBoolean()
  forbidEveningToNight?: boolean;

  // ── coverage / emergency toggles ──────────────────────────────────────────

  @IsOptional()
  @IsBoolean()
  guaranteeFullCoverage?: boolean;

  @IsOptional()
  @IsBoolean()
  allowEmergencyOverrides?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSecondShiftSameDayInEmergency?: boolean;

  @IsOptional()
  @IsBoolean()
  ignoreAvailabilityInEmergency?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNightCapOverrideInEmergency?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRestRuleOverrideInEmergency?: boolean;

  // ── goal toggles ───────────────────────────────────────────────────────────

  @IsOptional()
  @IsBoolean()
  goalMinimizeStaffCost?: boolean;

  @IsOptional()
  @IsBoolean()
  goalMaximizePreferenceSatisfaction?: boolean;

  @IsOptional()
  @IsBoolean()
  goalBalanceWorkload?: boolean;

  @IsOptional()
  @IsBoolean()
  goalBalanceNightWorkload?: boolean;

  @IsOptional()
  @IsBoolean()
  goalReduceUndesirableShifts?: boolean;

  @IsOptional()
  @IsBoolean()
  enableShiftTypeLimit?: boolean;

  @IsOptional()
  @IsObject()
  maxShiftPerType?: Record<string, number> | null;

  @IsOptional()
  @IsArray()
  shiftTypeLimitExemptNurses?: string[] | null;

  @IsOptional()
  @IsBoolean()
  eveningAfterMorningCountsAsOvertime?: boolean;

  @IsOptional()
  @IsBoolean()
  enableConsecutiveNightLimit?: boolean;

  @IsOptional()
  @IsBoolean()
  enableMinTotalDaysOff?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minTotalDaysOff?: number;

  // ── objective weights / fairness / goal priority ──────────────────────────

  @IsOptional()
  @IsObject()
  penaltyWeightJson?: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  fairnessWeightJson?: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  goalPriorityJson?: Record<string, any> | null;

  // ── solver execution tuning ────────────────────────────────────────────────

  @IsOptional()
  @IsInt()
  @Min(1)
  numSearchWorkers?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  timeLimitSec?: number;

  // ── meta ───────────────────────────────────────────────────────────────────

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
