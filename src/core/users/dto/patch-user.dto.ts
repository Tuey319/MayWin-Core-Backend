import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class PatchUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  organizationId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
