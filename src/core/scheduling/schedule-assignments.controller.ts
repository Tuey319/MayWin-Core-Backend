// src/core/scheduling/schedule-assignments.controller.ts
import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SchedulesService } from './schedules.service';
import { PatchAssignmentDto } from './dto/patch-assignment.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ScheduleAssignmentsController {
  constructor(private readonly schedules: SchedulesService) {}

  /**
   * Purpose: Manual edit of one schedule cell (override solver output).
   */
  @Patch('/schedule-assignments/:assignmentId')
  patch(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: PatchAssignmentDto,
  ) {
    return this.schedules.patchAssignment(assignmentId, dto);
  }
}
