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

  private callerRoles(req: Request): string[] {
    const user = (req as any).user ?? {};
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (user.role && !roles.includes(user.role)) roles.push(user.role);
    return roles;
  }

  private callerOrgId(req: Request): string {
    const user = (req as any).user ?? {};
    return String(user.organizationId ?? 'unknown');
  }

  @Get('/audit-logs')
  async list(
    @Req() req: Request,
    @Query('export') exportType: string | undefined,
    @Query('orgId') orgIdOverride: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const roles = this.callerRoles(req);
    const orgId = orgIdOverride ?? this.callerOrgId(req);

    if ((exportType ?? '').toLowerCase() === 'csv') {
      const csv = await this.auditLogs.readRawCsv(orgId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      return csv;
    }

    const { entries, maxLevel } = await this.auditLogs.listNewestFirst(orgId, roles);
    return { ok: true, logs: entries, maxLevel };
  }

  @Post('/audit-logs')
  async create(@Req() req: Request, @Body() dto: CreateAuditLogDto) {
    const user = (req as any).user ?? {};
    const actorId = dto.actorId ?? String(user.sub ?? user.id ?? 'unknown');
    const actorName = dto.actorName ?? String(user.fullName ?? user.name ?? user.email ?? 'Unknown');
    const orgId = String(user.organizationId ?? 'unknown');

    const log = await this.auditLogs.append({
      orgId,
      actorId,
      actorName,
      action: dto.action,
      targetType: dto.targetType ?? '',
      targetId: dto.targetId ?? '',
      detail: dto.detail ?? '',
      level: dto.level ?? 2,
    });

    return { ok: true, log };
  }
}
