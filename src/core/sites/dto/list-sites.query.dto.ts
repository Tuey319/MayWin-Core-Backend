// src/core/sites/dto/list-sites.query.dto.ts
import { IsIn, IsOptional, Matches } from 'class-validator';

export class ListSitesQueryDto {
  @IsOptional()
  search?: string;

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
