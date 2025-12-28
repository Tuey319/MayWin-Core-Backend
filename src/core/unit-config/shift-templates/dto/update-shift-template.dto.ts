// src/core/unit-config/shift-templates/dto/update-shift-template.dto.ts
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateShiftTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  startTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  endTime?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
