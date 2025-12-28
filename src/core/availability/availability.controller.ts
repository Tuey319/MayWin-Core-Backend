// src/core/availability/availability.controller.ts
import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AvailabilityService } from './availability.service';
import { GetAvailabilityQuery } from './dto/get-availability.query';
import { PutAvailabilityDto } from './dto/put-availability.dto';

@UseGuards(JwtAuthGuard)
@Controller('')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * Purpose: Fetch availability rules for a unit in a date range.
   * Spec: GET /units/{unitId}/availability?dateFrom&dateTo
   */
  @Get('/units/:unitId/availability')
  get(@Param('unitId') unitId: string, @Query() q: GetAvailabilityQuery) {
    return this.availability.get(unitId, q.dateFrom, q.dateTo);
  }

  /**
   * Purpose: Bulk upsert availability entries (head nurse or manager input).
   * Spec: PUT /units/{unitId}/availability
   */
  @Put('/units/:unitId/availability')
  put(@Param('unitId') unitId: string, @Body() dto: PutAvailabilityDto) {
    return this.availability.upsert(unitId, dto.entries);
  }
}
