// src/core/schedules/dto/create-schedule.dto.ts
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  // bigint in DB, but comes as string in API
  @IsOptional()
  @Matches(/^\d+$/)
  constraintProfileId?: string;
}
