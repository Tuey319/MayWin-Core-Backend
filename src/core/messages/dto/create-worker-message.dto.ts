// src/core/messages/dto/create-worker-message.dto.ts
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateWorkerMessageDto {
  @IsOptional()
  @Matches(/^\d+$/)
  senderUserId?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  senderWorkerId?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  organizationId?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  unitId?: string;

  @IsOptional()
  @IsIn(['INBOUND', 'OUTBOUND'])
  direction?: 'INBOUND' | 'OUTBOUND';

  @IsOptional()
  @IsIn(['SENT', 'DELIVERED', 'READ', 'ARCHIVED'])
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  scheduleId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  shiftDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  shiftCode?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
