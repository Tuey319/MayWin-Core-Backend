// src/core/schedules/dto/create-schedule.dto.ts
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @Matches(/^\d+$/)
  constraintProfileId?: string;
}
