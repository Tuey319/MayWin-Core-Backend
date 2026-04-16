// src/core/staff/dto/create-staff.dto.ts
import { IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  employeeId: string;

  /** LINE ID is now optional — nurse can link via invite code later */
  @IsOptional()
  @IsString()
  lineId?: string;

  @IsString()
  @IsIn(['nurse', 'head_nurse', 'scheduler', 'admin'])
  position: 'nurse' | 'head_nurse' | 'scheduler' | 'admin';

  @IsOptional()
  @IsEmail()
  email?: string;

  /** Unit to assign this nurse to. Falls back to the caller's unit if omitted. */
  @IsOptional()
  @IsNumber()
  unitId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
