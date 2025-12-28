// src/core/unit-config/constraint-profiles/dto/update-constraint-profile.dto.ts
import { IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateConstraintProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  maxConsecutiveWorkDays?: number | null;

  @IsOptional()
  @IsNumber()
  maxConsecutiveNightShifts?: number | null;

  @IsOptional()
  @IsNumber()
  minRestHoursBetweenShifts?: number | null;

  @IsOptional()
  @IsObject()
  fairnessWeightJson?: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  penaltyWeightJson?: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
