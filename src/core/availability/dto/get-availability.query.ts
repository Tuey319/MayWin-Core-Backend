// src/core/availability/dto/get-availability.query.ts
import { IsDateString } from 'class-validator';

export class GetAvailabilityQuery {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}
