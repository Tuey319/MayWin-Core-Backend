// src/core/organizations/dto/create-schedule-container.dto.ts
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateScheduleContainerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  site?: string;

  @IsOptional()
  @IsString()
  dept?: string;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'active', 'archived'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  profileId?: string;
}
