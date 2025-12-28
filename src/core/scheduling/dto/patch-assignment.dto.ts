// src/core/schedules/dto/patch-assignment.dto.ts
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class PatchAssignmentDto {
  @Matches(/^\d+$/)
  workerId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  shiftCode!: string;

  @IsOptional()
  attributes?: Record<string, any>;
}
