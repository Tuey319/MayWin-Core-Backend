// src/core/organizations/dto/patch-organization.dto.ts
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class PatchOrganizationDto {
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
  timezone?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
