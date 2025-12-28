// src/core/scheduling/schedules.controller.ts
import {
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
import { SchedulesService } from './schedules.service';

import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GetCurrentScheduleQuery } from './dto/get-current-schedule.query';
import { GetScheduleHistoryQuery } from './dto/get-history.query';

@UseGuards(JwtAuthGuard)
@Controller()
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  /**
   * Purpose: Create a schedule “container” for a unit + date horizon (no solver run yet).
   */
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
   */
  @Get('/units/:unitId/schedules/current')
  getCurrent(
    @Param('unitId') unitId: string,
    @Query() q: GetCurrentScheduleQuery,
  ) {
    return this.schedules.getCurrentSchedule(unitId, q.dateFrom, q.dateTo);
  }

  /**
   * Purpose: List past schedules for a unit (history UI).
   */
  @Get('/units/:unitId/schedules/history')
  history(
    @Param('unitId') unitId: string,
    @Query() q: GetScheduleHistoryQuery,
  ) {
    return this.schedules.getScheduleHistory(unitId, q.limit ?? 10);
  }

  /**
   * Purpose: Get schedule detail by id (plus assignments + shift templates).
   */
  @Get('/schedules/:scheduleId')
  getById(@Param('scheduleId') scheduleId: string) {
    return this.schedules.getScheduleById(scheduleId);
  }

  /**
   * Purpose: Export schedule (Phase 1: stub response; later return signed URL / stream).
   */
  @Get('/schedules/:scheduleId/export')
  export(
    @Param('scheduleId') scheduleId: string,
    @Query('format') format?: string,
  ) {
    return this.schedules.exportSchedule(scheduleId, (format ?? 'pdf') as any);
  }
}
