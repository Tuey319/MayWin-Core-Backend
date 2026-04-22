import { IsOptional, IsString } from 'class-validator';

export class AssignMembershipDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  roleCode?: string;
}
