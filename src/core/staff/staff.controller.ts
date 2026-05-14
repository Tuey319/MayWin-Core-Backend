// src/core/staff/staff.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { CreateStaffDto } from './dto/create-staff.dto';
import { PatchStaffDto } from './dto/patch-staff.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) { }

  private context(req: Request): { organizationId: number | null; unitId: number | null } {
    const user = (req as any).user ?? {};
    const unitIds = Array.isArray(user.unitIds) ? user.unitIds : [];
    const rawOrg = user.organizationId;
    const orgNum = rawOrg != null ? Number(rawOrg) : null;
    return {
      organizationId: orgNum && orgNum > 0 ? orgNum : null,
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

  // Returns actor identity from X-Actor-Id/X-Actor-Name headers only when the
  // request was authenticated with the BFF service token (CORE_API_TOKEN).
  // Regular JWT-authenticated requests cannot override actor identity this way.
  private resolveActor(req: Request): { actorId: string; actorName: string } {
    const serviceToken = process.env.CORE_API_TOKEN;
    if (serviceToken) {
      const rawToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      if (rawToken === serviceToken) {
        const headerId = req.headers['x-actor-id'];
        const headerName = req.headers['x-actor-name'];
        if (headerId) {
          return {
            actorId: String(headerId),
            actorName: String(headerName ?? headerId),
          };
        }
      }
    }
    return this.actor(req);
  }

  @Roles('HEAD_NURSE')
  @Get('/staff')
  list(@Req() req: Request) {
    const user = (req as any).user ?? {};
    const roles = Array.isArray(user.roles) ? user.roles : [];
    return this.staff.list(this.context(req).organizationId, roles);
  }

  @Roles('SCHEDULER')
  @Get('/staff/:id')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.staff.getById(id, this.context(req).organizationId);
  }

  @Roles('SCHEDULER')
  @Post('/staff')
  create(@Body() dto: CreateStaffDto, @Req() req: Request) {
    const user = (req as any).user ?? {};
    const userRoles: string[] = Array.isArray(user.roles) ? user.roles.map((r: string) => r.toLowerCase()) : [];
    const isUnrestricted = userRoles.some(r => r === 'admin' || r === 'super_admin');

    if (!isUnrestricted && dto.unitId != null) {
      const unitIds: (string | number)[] = Array.isArray(user.unitIds) ? user.unitIds : [];
      const allowed = unitIds.map(String);
      if (!allowed.includes(String(dto.unitId))) {
        throw new ForbiddenException('You can only create staff for your own unit');
      }
    }

    return this.staff.create(dto, this.actor(req), this.context(req));
  }

  @Roles('SCHEDULER')
  @Patch('/staff/:id')
  patch(@Param('id') id: string, @Body() dto: PatchStaffDto, @Req() req: Request) {
    return this.staff.patch(id, dto, this.resolveActor(req), this.context(req).organizationId);
  }

  @Roles('ADMIN')
  @Delete('/staff/:id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.staff.remove(id, this.actor(req), this.context(req).organizationId);
  }

  /**
   * POST /staff/:id/create-account
   * Create a new web login account for an existing worker that has no linked user.
   * Uses the email stored in worker.attributes.email and sends a welcome email.
   */
  @Roles('ADMIN')
  @Post('/staff/:id/create-account')
  createWebAccount(@Param('id') id: string, @Req() req: Request) {
    return this.staff.createWebAccount(id, this.context(req).organizationId, this.actor(req));
  }

  /**
   * POST /staff/:id/link-user
   * Link an existing user account to this worker.
   * Body: { userId: number }
   */
  @Roles('ADMIN')
  @Post('/staff/:id/link-user')
  linkUser(
    @Param('id') id: string,
    @Body('userId', ParseIntPipe) userId: number,
    @Req() req: Request,
  ) {
    return this.staff.linkUser(id, userId, this.context(req).organizationId, this.actor(req));
  }

  /**
   * POST /staff/:id/consent-reset
   * Reset a nurse's Gemini AI consent so the chatbot re-prompts them on next message.
   * Only HEAD_NURSE and above may perform this action — nurses cannot reset their own consent.
   */
  @Roles('HEAD_NURSE')
  @Post('/staff/:id/consent-reset')
  resetGeminiConsent(@Param('id') id: string, @Req() req: Request) {
    return this.staff.resetGeminiConsent(id, this.actor(req), this.context(req).organizationId ?? 0);
  }

  /**
   * POST /staff/:id/link-token
   * Generate a one-time LINE invite code for a nurse.
   * Returns { token, expiresAt, instruction }
   */
  @Roles('SCHEDULER')
  @Post('/staff/:id/link-token')
  generateLinkToken(@Param('id') id: string, @Req() req: Request) {
    return this.staff.generateLinkToken(id, this.context(req).organizationId, this.actor(req));
  }

  /**
   * PATCH /staff/:id/team-leader
   * Toggle team leader role for a worker in a unit.
   * Body: { unitId: number, isTeamLeader: boolean }
   */
  @Roles('SCHEDULER')
  @Patch('/staff/:id/team-leader')
  setTeamLeader(
    @Param('id') id: string,
    @Body('unitId', ParseIntPipe) unitId: number,
    @Body('isTeamLeader') isTeamLeader: boolean,
    @Req() req: Request,
  ) {
    if (typeof isTeamLeader !== 'boolean') {
      throw new BadRequestException('isTeamLeader must be a boolean');
    }
    const user = (req as any).user ?? {};
    const callerRoles: string[] = Array.isArray(user.roles) ? user.roles : [];
    return this.staff.setTeamLeader(id, unitId, isTeamLeader, this.context(req).organizationId, this.actor(req), callerRoles);
  }
}
