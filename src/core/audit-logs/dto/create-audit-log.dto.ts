import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/** RFC 5424 (Syslog) numeric severity level, stored as integer 0–7.
 *  0=emergency 1=alert 2=critical 3=error 4=warning 5=notice 6=informational 7=debug
 *  Lower number = higher severity (same convention as syslog).
 */
export type LogLevel = number;

export const LEVEL_NAMES = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'informational', 'debug'] as const;
export const LEVEL_MIN = 0;
export const LEVEL_MAX = 7;

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
