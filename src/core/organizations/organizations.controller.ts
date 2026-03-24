// src/core/organizations/organizations.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { ScheduleContainersService } from './schedule-containers.service';
import { ConstraintProfilesService } from '../unit-config/constraint-profiles/constraint-profiles.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { PatchOrganizationDto } from './dto/patch-organization.dto';
import { CreateScheduleContainerDto } from './dto/create-schedule-container.dto';
import { UpdateScheduleContainerDto } from './dto/update-schedule-container.dto';
import { CreateConstraintProfileDto } from '../unit-config/constraint-profiles/dto/create-constraint-profile.dto';
import { UpdateConstraintProfileDto } from '../unit-config/constraint-profiles/dto/update-constraint-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class OrganizationsController {
  constructor(
    private readonly svc: OrganizationsService,
    private readonly containers: ScheduleContainersService,
    private readonly profiles: ConstraintProfilesService,
  ) {}

  // ── Organization tree ───────────────────────────────────────────────────────

  /** GET /organizations — returns the authenticated user's organization */
  @Get('/organizations')
  list(@Req() req: Request) {
    const u = (req as any).user ?? {};
    const orgId = Number(u.organizationId);
    const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
    return this.svc.list(orgId, roles);
  }

  /** GET /organizations/me */
  @Get('/organizations/me')
  me(@Req() req: Request) {
    const orgId = Number((req as any).user?.organizationId);
    return this.svc.getMe(orgId);
  }

  /** GET /organizations/:orgId */
  @Get('/organizations/:orgId')
  getById(@Req() req: Request, @Param('orgId') orgId: string) {
    const u = (req as any).user ?? {};
    const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
    return this.svc.getById(orgId, Number(u.organizationId), roles);
  }

  /** POST /organizations (bootstrapping only) */
  @Post('/organizations')
  create(@Body() dto: CreateOrganizationDto) {
    return this.svc.create(dto);
  }

  /** PUT /organizations — save full org tree (upsert via patch of caller's org) */
  @Put('/organizations')
  put(@Req() req: Request, @Body() dto: PatchOrganizationDto) {
    const u = (req as any).user ?? {};
    const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
    return this.svc.patch(String(u.organizationId), Number(u.organizationId), dto, roles);
  }

  /** PATCH /organizations/:orgId */
  @Patch('/organizations/:orgId')
  patch(@Req() req: Request, @Param('orgId') orgId: string, @Body() dto: PatchOrganizationDto) {
    const u = (req as any).user ?? {};
    const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
    return this.svc.patch(orgId, Number(u.organizationId), dto, roles);
  }

  /** DELETE /organizations/:orgId */
  @Delete('/organizations/:orgId')
  delete(@Req() req: Request, @Param('orgId') orgId: string) {
    const u = (req as any).user ?? {};
    const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
    return this.svc.delete(orgId, Number(u.organizationId), roles);
  }

  // ── Schedule containers ─────────────────────────────────────────────────────

  /** GET /organizations/:orgId/schedule-containers */
  @Get('/organizations/:orgId/schedule-containers')
  listContainers(@Param('orgId') orgId: string) {
    return this.containers.list(orgId);
  }

  /** POST /organizations/:orgId/schedule-containers */
  @Post('/organizations/:orgId/schedule-containers')
  createContainer(
    @Param('orgId') orgId: string,
    @Body() dto: CreateScheduleContainerDto,
    @Req() req: Request,
  ) {
    const userId = String((req as any).user?.id ?? (req as any).user?.sub);
    return this.containers.create(orgId, dto, userId);
  }

  /** PUT /organizations/:orgId/schedule-containers/:id */
  @Put('/organizations/:orgId/schedule-containers/:id')
  updateContainer(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleContainerDto,
  ) {
    return this.containers.update(orgId, id, dto);
  }

  /** DELETE /organizations/:orgId/schedule-containers/:id */
  @Delete('/organizations/:orgId/schedule-containers/:id')
  deleteContainer(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.containers.delete(orgId, id);
  }

  // ── Constraint profiles ─────────────────────────────────────────────────────

  /** GET /organizations/:orgId/constraint-profiles */
  @Get('/organizations/:orgId/constraint-profiles')
  listProfiles(@Param('orgId') orgId: string) {
    return this.profiles.listByOrg(orgId);
  }

  /** POST /organizations/:orgId/constraint-profiles */
  @Post('/organizations/:orgId/constraint-profiles')
  createProfile(
    @Param('orgId') orgId: string,
    @Body() dto: CreateConstraintProfileDto,
  ) {
    return this.profiles.createForOrg(orgId, dto);
  }

  /** PUT /organizations/:orgId/constraint-profiles/:id */
  @Put('/organizations/:orgId/constraint-profiles/:id')
  updateProfile(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConstraintProfileDto,
  ) {
    return this.profiles.updateForOrg(orgId, id, dto);
  }

  /** DELETE /organizations/:orgId/constraint-profiles/:id */
  @Delete('/organizations/:orgId/constraint-profiles/:id')
  deleteProfile(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.profiles.deleteForOrg(orgId, id);
  }
}
