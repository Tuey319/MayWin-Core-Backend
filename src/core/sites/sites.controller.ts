// src/core/sites/sites.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { SitesService } from './sites.service';
import { ListSitesQueryDto } from './dto/list-sites.query.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { PatchSiteDto } from './dto/patch-site.dto';

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
  @Roles('DEPARTMENT_HEAD')
  @Get('/sites')
  list(@Req() req: Request, @Query() q: ListSitesQueryDto) {
    return this.svc.list(this.ctx(req), q);
  }

  // POST /sites
  @Roles('HOSPITAL_ADMIN')
  @Post('/sites')
  create(@Req() req: Request, @Body() dto: CreateSiteDto) {
    return this.svc.create(this.ctx(req), dto);
  }

  // PATCH /sites/:siteId
  @Roles('HOSPITAL_ADMIN')
  @Patch('/sites/:siteId')
  patch(@Req() req: Request, @Param('siteId') siteId: string, @Body() dto: PatchSiteDto) {
    return this.svc.patch(this.ctx(req), siteId, dto);
  }

  // POST /sites/:siteId/activate
  @Roles('HOSPITAL_ADMIN')
  @Post('/sites/:siteId/activate')
  activate(@Req() req: Request, @Param('siteId') siteId: string) {
    return this.svc.activate(this.ctx(req), siteId);
  }

  // POST /sites/:siteId/deactivate
  @Roles('HOSPITAL_ADMIN')
  @Post('/sites/:siteId/deactivate')
  deactivate(@Req() req: Request, @Param('siteId') siteId: string) {
    return this.svc.deactivate(this.ctx(req), siteId);
  }

  // DELETE /sites/:siteId
  @Roles('HOSPITAL_ADMIN')
  @Delete('/sites/:siteId')
  delete(@Req() req: Request, @Param('siteId') siteId: string) {
    return this.svc.delete(this.ctx(req), siteId);
  }
}
