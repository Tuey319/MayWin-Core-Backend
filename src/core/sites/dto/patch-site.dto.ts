// src/core/sites/dto/patch-site.dto.ts
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class PatchSiteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
