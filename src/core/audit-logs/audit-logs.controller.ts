import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AuditLogsService } from './audit-logs.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get('/audit-logs')
  async list(
    @Query('export') exportType: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if ((exportType ?? '').toLowerCase() === 'csv') {
      const csv = await this.auditLogs.readRawCsv();
      const ts = Date.now();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-logs-${ts}.csv"`,
      );

      return csv;
    }

    const logs = await this.auditLogs.listNewestFirst();
    return { ok: true, logs };
  }

  @Post('/audit-logs')
  async create(@Req() req: Request, @Body() dto: CreateAuditLogDto) {
    const user = (req as any).user ?? {};

    const actorId = String(user.sub ?? user.id ?? 'unknown');
    const actorName = String(user.fullName ?? user.name ?? user.email ?? 'Unknown');

    const log = await this.auditLogs.append({
      actorId,
      actorName,
      action: dto.action,
      targetType: dto.targetType,
      targetId: dto.targetId,
      detail: dto.detail,
    });

    return { ok: true, log };
  }
}
