// src/core/organizations/dto/update-schedule-container.dto.ts
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateScheduleContainerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  site?: string;

  @IsOptional()
  @IsString()
  dept?: string;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

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
