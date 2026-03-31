import { IsString, MinLength } from 'class-validator';

export class PatchUsernameDto {
  @IsString()
  @MinLength(1)
  fullName: string;
}
