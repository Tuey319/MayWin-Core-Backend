// src/core/jobs/dto/apply-job.dto.ts
import { IsBoolean, IsOptional } from 'class-validator';

export class ApplyJobDto {
  @IsOptional()
  @IsBoolean()
  overwriteManualChanges?: boolean;
}
