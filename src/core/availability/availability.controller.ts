// src/core/availability/availability.controller.ts
import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { AvailabilityService } from './availability.service';
import { GetAvailabilityQuery } from './dto/get-availability.query';
import { PutAvailabilityDto } from './dto/put-availability.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * Purpose: Fetch availability rules for a unit in a date range.
   * Spec: GET /units/{unitId}/availability?dateFrom&dateTo
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/units/:unitId/availability')
  get(@Param('unitId') unitId: string, @Query() q: GetAvailabilityQuery) {
    return this.availability.get(unitId, q.dateFrom, q.dateTo);
  }

  /**
   * Purpose: Bulk upsert availability entries (head nurse or manager input).
   * Spec: PUT /units/{unitId}/availability
   * PDPA §27, ISO 27001:2022 A.8.15 — actor passed to service for audit logging
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Put('/units/:unitId/availability')
  put(@Param('unitId') unitId: string, @Body() dto: PutAvailabilityDto, @Req() req: any) {
    const actor = {
      actorId: String(req.user?.sub ?? req.user?.id ?? 'unknown'),
      actorName: String(req.user?.fullName ?? req.user?.email ?? 'Unknown'),
      orgId: String(req.user?.organizationId ?? 'unknown'),
    };
    return this.availability.upsert(unitId, dto.entries, actor);
  }
}
