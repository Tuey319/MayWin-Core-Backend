import { IsDateString, IsOptional } from 'class-validator';

export class GetCurrentScheduleQuery {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
