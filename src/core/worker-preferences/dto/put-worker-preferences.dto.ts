// src/core/worker-preferences/dto/put-worker-preferences.dto.ts
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ShiftWeightDto {
  @IsString()
  shiftCode!: string;

  @IsInt()
  @Min(-100)
  @Max(100)
  weight!: number;
}

export class WorkerPreferencesDto {

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftWeightDto)
  shiftWeights?: ShiftWeightDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hardBlockedShiftCodes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(14)
  maxNightShiftsPerWeek?: number;

  @IsOptional()
  @IsBoolean()
  acceptsOvertime?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

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
