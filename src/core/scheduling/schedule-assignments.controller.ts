// src/core/scheduling/schedule-assignments.controller.ts
import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { SchedulesService } from './schedules.service';
import { PatchAssignmentDto } from './dto/patch-assignment.dto';

@Roles('HEAD_NURSE')
@UseGuards(JwtAuthGuard)
@Controller()
export class ScheduleAssignmentsController {
  constructor(private readonly schedules: SchedulesService) {}

  /**
   * Purpose: Manual edit of one schedule cell (override solver output).
   * ISO 27001:2022 A.5.15 — org ownership verified in service via parent schedule
   */
  @Patch('/schedule-assignments/:assignmentId')
  patch(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: PatchAssignmentDto,
    @Req() req: any,
  ) {
    return this.schedules.patchAssignment(assignmentId, dto, Number(req.user?.organizationId));
  }
}
