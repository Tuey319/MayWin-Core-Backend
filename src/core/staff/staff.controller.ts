// src/core/staff/staff.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { StaffService } from './staff.service';
import { DataSubjectService } from './data-subject.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { PatchStaffDto } from './dto/patch-staff.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly dataSubject: DataSubjectService,
  ) { }

  private context(req: Request): { organizationId: number; unitId: number | null } {
    const user = (req as any).user ?? {};
    const unitIds = Array.isArray(user.unitIds) ? user.unitIds : [];
    return {
      organizationId: Number(user.organizationId ?? 0),
      unitId: unitIds.length > 0 ? Number(unitIds[0]) : null,
    };
  }

  private actor(req: Request): { actorId: string; actorName: string } {
    const user = (req as any).user ?? {};
    return {
      actorId: String(user.sub ?? user.id ?? 'unknown'),
      actorName: String(user.fullName ?? user.name ?? user.email ?? 'Unknown'),
    };
  }

  @Roles('HEAD_NURSE')
  @Get('/staff')
  list(@Req() req: Request) {
    const user = (req as any).user ?? {};
    const roles = Array.isArray(user.roles) ? user.roles : [];
    return this.staff.list(this.context(req).organizationId, roles);
  }

  @Roles('HEAD_NURSE')
  @Get('/staff/:id')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.staff.getById(id, this.context(req).organizationId);
  }

  @Roles('HEAD_NURSE')
  @Post('/staff')
  create(@Body() dto: CreateStaffDto, @Req() req: Request) {
    return this.staff.create(dto, this.actor(req), this.context(req));
  }

  @Roles('HEAD_NURSE')
  @Patch('/staff/:id')
  patch(@Param('id') id: string, @Body() dto: PatchStaffDto, @Req() req: Request) {
    return this.staff.patch(id, dto, this.actor(req), this.context(req).organizationId);
  }

  @Roles('HOSPITAL_ADMIN')
  @Delete('/staff/:id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.staff.remove(id, this.actor(req), this.context(req).organizationId);
  }

  /**
   * POST /staff/:id/create-account
   * Create a new web login account for an existing worker that has no linked user.
   */
  @Roles('HOSPITAL_ADMIN')
  @Post('/staff/:id/create-account')
  createWebAccount(@Param('id') id: string, @Req() req: Request) {
    return this.staff.createWebAccount(id, this.context(req).organizationId, this.actor(req));
  }

  /**
   * POST /staff/:id/link-user
   * Link an existing user account to this worker.
   * Body: { userId: number }
   */
  @Roles('HOSPITAL_ADMIN')
  @Post('/staff/:id/link-user')
  linkUser(
    @Param('id') id: string,
    @Body('userId', ParseIntPipe) userId: number,
    @Req() req: Request,
  ) {
    return this.staff.linkUser(id, userId, this.context(req).organizationId, this.actor(req));
  }

  /**
   * POST /staff/:id/link-token
   * Generate a one-time LINE invite code for a nurse.
   */
  @Roles('HEAD_NURSE')
  @Post('/staff/:id/link-token')
  generateLinkToken(@Param('id') id: string, @Req() req: Request) {
    return this.staff.generateLinkToken(id, this.context(req).organizationId, this.actor(req));
  }

  /**
   * DELETE /staff/:id/personal-data
   * PDPA §33 right-to-erasure — anonymise PII for a worker (HOSPITAL_ADMIN only).
   */
  @Roles('HOSPITAL_ADMIN')
  @Delete('/staff/:id/personal-data')
  erasePersonalData(@Param('id') id: string, @Req() req: Request) {
    return this.dataSubject.eraseWorker(id, this.actor(req).actorId);
  }
}
