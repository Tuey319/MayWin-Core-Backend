import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListUnitWorkerPreferencesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort?: 'ASC' | 'DESC';
}
