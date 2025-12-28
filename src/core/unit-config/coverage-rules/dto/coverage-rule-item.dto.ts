// src/core/unit-config/coverage-rules/dto/coverage-rule-item.dto.ts
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CoverageRuleItemDto {
  @IsString()
  @IsNotEmpty()
  shiftCode!: string;

  @IsString()
  @IsNotEmpty()
  dayType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minWorkers?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxWorkers?: number | null;

  @IsOptional()
  @IsString()
  requiredTag?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
