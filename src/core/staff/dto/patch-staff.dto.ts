import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class PatchStaffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['nurse', 'scheduler', 'admin'])
  position?: 'nurse' | 'scheduler' | 'admin';

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
