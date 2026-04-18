import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/** Winston-style numeric log level stored as integer 0–6.
 *  0=error 1=warn 2=info 3=http 4=verbose 5=debug 6=silly
 */
export type LogLevel = number;

export const LEVEL_NAMES = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const;
export const LEVEL_MIN = 0;
export const LEVEL_MAX = 6;

export class CreateAuditLogDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsOptional()
  actorId?: string;

  @IsString()
  @IsOptional()
  actorName?: string;

  @IsString()
  @IsOptional()
  targetType?: string;

  @IsString()
  @IsOptional()
  targetId?: string;

  @IsString()
  @IsOptional()
  detail?: string;

  @IsOptional()
  @IsInt()
  @Min(LEVEL_MIN)
  @Max(LEVEL_MAX)
  level?: LogLevel;
}
