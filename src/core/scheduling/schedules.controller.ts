// src/core/scheduling/schedules.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { SchedulesService } from './schedules.service';

import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GetCurrentScheduleQuery } from './dto/get-current-schedule.query';
import { GetScheduleHistoryQuery } from './dto/get-history.query';

@Roles('HEAD_NURSE')
@UseGuards(JwtAuthGuard)
@Controller()
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get('/schedules')
  listAll() {
    return this.schedules.listAll();
  }

  /**
   * Purpose: Create a schedule "container" for a unit + date horizon (no solver run yet).
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Post('/units/:unitId/schedules')
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateScheduleDto,
    @Req() req: any,
  ) {
    const createdBy =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? req.user?.uid;

    return this.schedules.createSchedule(unitId, dto, createdBy);
  }

  /**
   * Purpose: Fetch the current schedule (plus assignments + shift templates for UI rendering).
   * ISO 27001:2022 A.5.15 — callerOrgId enforced in service
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/units/:unitId/schedules/current')
  getCurrent(
    @Param('unitId') unitId: string,
    @Query() q: GetCurrentScheduleQuery,
    @Req() req: any,
  ) {
    return this.schedules.getCurrentSchedule(unitId, q.dateFrom, q.dateTo, Number(req.user?.organizationId));
  }

  /**
   * Compatibility alias for BFF: GET /schedule?unitId=2
   * ISO 27001:2022 A.5.15 — callerOrgId enforced in service
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/schedule')
  async getCurrentCompat(@Query('unitId') unitId: string, @Req() req: any) {
    if (!unitId) throw new BadRequestException('unitId is required');

    const result = await this.schedules.getCurrentSchedule(unitId, undefined, undefined, Number(req.user?.organizationId));

    return {
      success: true,
      result: {
        assignments: result.assignments,
      },
    };
  }

  /**
   * Purpose: List past schedules for a unit (history UI).
   * ISO 27001:2022 A.5.15 — callerOrgId enforced in service
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/units/:unitId/schedules/history')
  history(
    @Param('unitId') unitId: string,
    @Query() q: GetScheduleHistoryQuery,
    @Req() req: any,
  ) {
    return this.schedules.getScheduleHistory(unitId, q.limit ?? 10, Number(req.user?.organizationId));
  }

  /**
   * Purpose: Get schedule detail by id (plus assignments + shift templates).
   * ISO 27001:2022 A.5.15 — callerOrgId enforced in service
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN', 'NURSE')
  @Get('/schedules/:scheduleId')
  getById(@Param('scheduleId') scheduleId: string, @Req() req: any) {
    return this.schedules.getScheduleById(scheduleId, Number(req.user?.organizationId));
  }

  /**
   * Purpose: Export schedule (Phase 1: stub response; later return signed URL / stream).
   * ISO 27001:2022 A.5.15 — callerOrgId enforced in service
   */
  @Roles('UNIT_MANAGER', 'ORG_ADMIN')
  @Get('/schedules/:scheduleId/export')
  export(
    @Param('scheduleId') scheduleId: string,
    @Query('format') format: string,
    @Req() req: any,
  ) {
    return this.schedules.exportSchedule(scheduleId, (format ?? 'pdf') as any, Number(req.user?.organizationId));
  }
}
