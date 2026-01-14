// src/core/sites/sites.controller.ts
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SitesService } from './sites.service';
import { ListSitesQueryDto } from './dto/list-sites.query.dto';
import { CreateSiteDto } from './dto/create-site.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class SitesController {
  constructor(private readonly svc: SitesService) {}

  private ctx(req: Request) {
    const u = (req as any).user ?? {};
    return {
      organizationId: Number(u.organizationId),
      roles: Array.isArray(u.roles) ? u.roles : [],
    };
  }

  // GET /sites
  @Get('/sites')
  list(@Req() req: Request, @Query() q: ListSitesQueryDto) {
    return this.svc.list(this.ctx(req), q);
  }

  // POST /sites
  @Post('/sites')
  create(@Req() req: Request, @Body() dto: CreateSiteDto) {
    return this.svc.create(this.ctx(req), dto);
  }

  // POST /sites/:siteId/deactivate
  @Post('/sites/:siteId/deactivate')
  deactivate(@Req() req: Request, @Param('siteId') siteId: string) {
    return this.svc.deactivate(this.ctx(req), siteId);
  }
}
