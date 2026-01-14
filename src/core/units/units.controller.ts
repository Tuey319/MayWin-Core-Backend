// src/core/units/units.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UnitsService } from './units.service';
import { ListUnitsQueryDto } from './dto/list-units.query.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { PatchUnitDto } from './dto/patch-unit.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class UnitsController {
  constructor(private readonly svc: UnitsService) {}

  private ctx(req: Request) {
    const u = (req as any).user ?? {};
    return {
      organizationId: Number(u.organizationId),
      roles: Array.isArray(u.roles) ? u.roles : [],
      unitIds: Array.isArray(u.unitIds) ? u.unitIds : [],
    };
  }

  // GET /units
  @Get('/units')
  list(@Req() req: Request, @Query() q: ListUnitsQueryDto) {
    return this.svc.list(this.ctx(req), q);
  }

  // GET /units/:unitId
  @Get('/units/:unitId')
  get(@Req() req: Request, @Param('unitId') unitId: string) {
    return this.svc.getById(this.ctx(req), unitId);
  }

  // POST /units
  @Post('/units')
  create(@Req() req: Request, @Body() dto: CreateUnitDto) {
    return this.svc.create(this.ctx(req), dto);
  }

  // PATCH /units/:unitId
  @Patch('/units/:unitId')
  patch(@Req() req: Request, @Param('unitId') unitId: string, @Body() dto: PatchUnitDto) {
    return this.svc.patch(this.ctx(req), unitId, dto);
  }

  // POST /units/:unitId/deactivate
  @Post('/units/:unitId/deactivate')
  deactivate(@Req() req: Request, @Param('unitId') unitId: string) {
    return this.svc.deactivate(this.ctx(req), unitId);
  }
}
