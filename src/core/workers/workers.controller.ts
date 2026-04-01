// src/core/workers/workers.controller.ts
import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { WorkersService } from './workers.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  /**
   * Purpose: List all workers in a unit (used for scheduling UI).
   * Spec: GET /units/{unitId}/workers
   */
  @Get('/units/:unitId/workers')
  list(
    @Param('unitId') unitId: string,
    @Query('search') search?: string,
  ) {
    return this.workers.listWorkers(unitId, search ?? null);
  }

  /**
   * Compatibility alias for BFF: GET /nurses/export?unitId=2
   */
  @Get('/nurses/export')
  async exportNurses(@Query('unitId') unitId?: string) {
    const targetUnitId = unitId ?? '2';
    const result = await this.workers.listWorkers(targetUnitId, null);
    const overallAverageSatisfaction =
      await this.workers.getOverallAverageSatisfaction(targetUnitId);

    return {
      overallAverageSatisfaction,
      nurses: (result.workers ?? []).map((w) => ({
        id: Number(w.id),
        name: w.fullName,
        level: null,
        employment_type: w.employmentType,
        unit: targetUnitId,
      })),
    };
  }

  /**
   * GET /workers/me/schedule?month=2026-04
   * Returns the authenticated nurse's shift assignments for the given month.
   */
  @Get('/workers/me/schedule')
  getMySchedule(
    @Req() req: Request,
    @Query('month') month?: string,
  ) {
    const user = (req as any).user;
    const target = month ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(target)) {
      throw new BadRequestException('month must be in YYYY-MM format');
    }
    return this.workers.getMySchedule(Number(user.sub), target);
  }

  /**
   * Dashboard KPI summary for donut charts.
   * Optional date filter matches the dashboard window.
   *
   * GET /units/:unitId/kpis/summary?startDate=2026-03-09&endDate=2026-03-15
   */
  @Get('/units/:unitId/kpis/summary')
  getKpiSummary(
    @Param('unitId') unitId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.workers.getDashboardKpiSummary(unitId, {
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    });
  }
}
