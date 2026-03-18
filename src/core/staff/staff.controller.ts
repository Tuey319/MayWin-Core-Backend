// src/core/staff/staff.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { PatchStaffDto } from './dto/patch-staff.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) { }

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

  @Get('/staff')
  list(@Req() req: Request) {
    return this.staff.list(this.context(req).organizationId);
  }

  @Get('/staff/:id')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.staff.getById(id, this.context(req).organizationId);
  }

  @Post('/staff')
  create(@Body() dto: CreateStaffDto, @Req() req: Request) {
    return this.staff.create(dto, this.actor(req), this.context(req));
  }

  @Patch('/staff/:id')
  patch(@Param('id') id: string, @Body() dto: PatchStaffDto, @Req() req: Request) {
    return this.staff.patch(id, dto, this.actor(req), this.context(req).organizationId);
  }

  @Delete('/staff/:id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.staff.remove(id, this.actor(req), this.context(req).organizationId);
  }

  /**
   * POST /staff/:id/link-token
   * Generate a one-time LINE invite code for a nurse.
   * Returns { token, expiresAt, instruction }
   */
  @Post('/staff/:id/link-token')
  generateLinkToken(@Param('id') id: string, @Req() req: Request) {
    return this.staff.generateLinkToken(id, this.context(req).organizationId, this.actor(req));
  }
}
