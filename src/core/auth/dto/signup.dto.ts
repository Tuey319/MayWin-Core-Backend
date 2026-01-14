// src/core/auth/dto/signup.dto.ts
import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class SignupDto {
  @IsOptional()
  @Matches(/^\d+$/)
  organizationId?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  unitId?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  roleCode?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
