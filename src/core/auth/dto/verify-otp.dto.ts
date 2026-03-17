// src/core/auth/dto/verify-otp.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyOtpDto {
  /** Short-lived pending token returned by /auth/login when 2FA is required */
  @IsString()
  @IsNotEmpty()
  otpToken: string;

  /** The 6-digit code sent to the user's email */
  @IsString()
  @IsNotEmpty()
  otp: string;
}
