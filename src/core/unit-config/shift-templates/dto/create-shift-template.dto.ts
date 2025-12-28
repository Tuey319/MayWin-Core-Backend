// src/core/unit-config/shift-templates/dto/create-shift-template.dto.ts
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShiftTemplateDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  // keep as string "HH:MM:SS" or "HH:MM"
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsOptional()
  attributes?: Record<string, any>;

  // optional override; normally always active
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
