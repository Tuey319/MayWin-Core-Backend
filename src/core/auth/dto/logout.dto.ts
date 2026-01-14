// src/core/auth/dto/logout.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsString()
  deviceId?: string;
}
