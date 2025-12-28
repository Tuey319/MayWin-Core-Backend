// src/core/jobs/dto/create-job.dto.ts
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateJobDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  // keep strategy/solverConfig/options flexible for solver-agnostic contract
  @IsOptional()
  @IsObject()
  strategy?: Record<string, any>;

  @IsOptional()
  @IsObject()
  solverConfig?: Record<string, any>;

  @IsOptional()
  @IsObject()
  options?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
