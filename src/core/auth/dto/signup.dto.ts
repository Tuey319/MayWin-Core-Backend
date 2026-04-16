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
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  roleCode?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
