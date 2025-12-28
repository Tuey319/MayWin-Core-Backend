// src/core/workers/dto/put-preferences.dto.ts
import { IsBoolean, IsObject, IsOptional, IsInt, Min } from 'class-validator';

export class PutWorkerPreferencesDto {
  @IsOptional()
  @IsBoolean()
  prefersDayShifts?: boolean;

  @IsOptional()
  @IsBoolean()
  prefersNightShifts?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxConsecutiveWorkDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxConsecutiveNightShifts?: number;

  @IsOptional()
  @IsObject()
  preferencePatternJson?: Record<string, any>;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
