// src/core/units/dto/patch-unit.dto.ts
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class PatchUnitDto {
  @IsOptional()
  @Matches(/^\d+$/)
  siteId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
