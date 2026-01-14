// src/core/messages/dto/list-worker-messages.query.dto.ts
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

export class ListWorkerMessagesQueryDto {
  @IsOptional()
  @Matches(/^\d+$/)
  unitId?: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsIn(['SENT', 'DELIVERED', 'READ', 'ARCHIVED'])
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'ARCHIVED';

  @IsOptional()
  @IsIn(['INBOUND', 'OUTBOUND'])
  direction?: 'INBOUND' | 'OUTBOUND';

  @IsOptional()
  @Matches(/^\d+$/)
  limit?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  offset?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort?: 'ASC' | 'DESC';
}
