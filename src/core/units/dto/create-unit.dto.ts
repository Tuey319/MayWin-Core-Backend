// src/core/units/dto/create-unit.dto.ts
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class CreateUnitDto {
  @Matches(/^\d+$/)
  organizationId!: string;

  @IsOptional()
  @Matches(/^\d+$/)
  siteId?: string | null;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

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
