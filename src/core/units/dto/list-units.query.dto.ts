// src/core/units/dto/list-units.query.dto.ts
import { IsIn, IsOptional, Matches } from 'class-validator';

export class ListUnitsQueryDto {
  @IsOptional()
  search?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  siteId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  limit?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  offset?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort?: 'ASC' | 'DESC';
}
