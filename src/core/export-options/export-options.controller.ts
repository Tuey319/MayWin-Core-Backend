import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ExportOptionsService } from './export-options.service';

@Controller('export-options')
@UseGuards(JwtAuthGuard)
export class ExportOptionsController {
  constructor(private readonly service: ExportOptionsService) {}

  @Get('me')
  async get(@Req() req: Request) {
    const user = (req as any).user;
    return this.service.get(String(user.sub));
  }

  @Put('me')
  async upsert(@Req() req: Request, @Body() data: any) {
    const user = (req as any).user;
    return this.service.upsert(String(user.sub), data);
  }
}
