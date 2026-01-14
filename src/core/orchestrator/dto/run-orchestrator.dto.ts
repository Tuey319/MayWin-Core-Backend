// src/core/orchestrator/dto/run-orchestrator.dto.ts
import { Type } from 'class-transformer';
import { IsISO8601, IsObject, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

export class RunOrchestratorBodyDto {
  @IsISO8601({ strict: true })
  startDate!: string;

  @IsISO8601({ strict: true })
  endDate!: string;

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

export class RunOrchestratorDto {
  @IsString()
  @Length(1, 64)
  scheduleId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 256)
  idempotencyKey?: string | null;

  @ValidateNested()
  @Type(() => RunOrchestratorBodyDto)
  dto!: RunOrchestratorBodyDto;
}
