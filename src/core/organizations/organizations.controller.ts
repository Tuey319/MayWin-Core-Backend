// src/core/organizations/organizations.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { PatchOrganizationDto } from './dto/patch-organization.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  // GET /organizations/me
  @Get('/organizations/me')
  me(@Req() req: Request) {
    const orgId = Number((req as any).user?.organizationId);
    return this.svc.getMe(orgId);
  }

  // POST /organizations (optional, for bootstrapping)
  @Post('/organizations')
  create(@Body() dto: CreateOrganizationDto) {
    return this.svc.create(dto);
  }

  // PATCH /organizations/:orgId (scoped to req.user.organizationId)
  @Patch('/organizations/:orgId')
  patch(@Req() req: Request, @Param('orgId') orgId: string, @Body() dto: PatchOrganizationDto) {
    const requestOrgId = Number((req as any).user?.organizationId);
    return this.svc.patch(orgId, requestOrgId, dto);
  }
}
