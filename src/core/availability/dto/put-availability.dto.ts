// src/core/availability/dto/put-availability.dto.ts
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AvailabilityType } from '@/database/entities/workers/worker-availability.entity';

export class AvailabilityEntryDto {
  @IsString()
  workerId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  shiftCode!: string;

  @IsEnum(AvailabilityType)
  type!: AvailabilityType;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  reason?: string | null;

  @IsOptional()
  attributes?: Record<string, any>;
}

export class PutAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityEntryDto)
  entries!: AvailabilityEntryDto[];
}
