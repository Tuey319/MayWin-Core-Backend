import { IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;
}
