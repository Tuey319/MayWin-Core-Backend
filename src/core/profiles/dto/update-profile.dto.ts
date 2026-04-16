// src/core/profiles/dto/update-profile.dto.ts
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  // E.164-compatible phone pattern — digits, spaces, hyphens, parens, optional leading +
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()\u200b]{7,20}$/, { message: 'Invalid phone number format' })
  phone_number?: string;
}
