// src/core/worker-preferences/dto/put-worker-preferences.dto.ts
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ShiftWeightDto {
  @IsString()
  shiftCode!: string;

  // higher = more preferred; allow negatives for avoid
  @IsInt()
  @Min(-100)
  @Max(100)
  weight!: number;
}

export class WorkerPreferencesDto {
  /**
   * soft prefs: "I prefer DAY more than NIGHT", etc.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftWeightDto)
  shiftWeights?: ShiftWeightDto[];

  /**
   * hard blocks: "never assign me NIGHT"
   * (solver can interpret as hard constraint or big penalty)
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hardBlockedShiftCodes?: string[];

  /**
   * max night shifts per week for this worker (optional override)
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(14)
  maxNightShiftsPerWeek?: number;

  /**
   * whether worker accepts overtime (policy + UI flag)
   */
  @IsOptional()
  @IsBoolean()
  acceptsOvertime?: boolean;

  /**
   * free-form tags (e.g., "ICU", "PEDS", "ChargeNurse")
   * helpful for coverage rules with required_tag
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /**
   * escape hatch for future expansion without API-breaking changes
   */
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}

export class PutWorkerPreferencesDto {
  @Matches(/^\d+$/)
  unitId!: string;

  @ValidateNested()
  @Type(() => WorkerPreferencesDto)
  preferences!: WorkerPreferencesDto;
}
