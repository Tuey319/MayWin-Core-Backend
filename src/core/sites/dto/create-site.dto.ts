// src/core/sites/dto/create-site.dto.ts
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class CreateSiteDto {
  @Matches(/^\d+$/)
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
