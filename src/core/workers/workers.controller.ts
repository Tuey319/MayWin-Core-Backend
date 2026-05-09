// src/core/workers/workers.controller.ts
import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { WorkersService } from './workers.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  /**
   * Purpose: List all workers in a unit (used for scheduling UI).
   * Spec: GET /units/{unitId}/workers
   * Gemini consent fields are included only for non-nurse callers.
   */
  @Roles('HEAD_NURSE')
  @Get('/units/:unitId/workers')
  list(
    @Req() req: Request,
    @Param('unitId') unitId: string,
    @Query('search') search?: string,
  ) {
    const user = (req as any).user ?? {};
    const callerRole = String(user.role ?? '');
    const organizationId = String(user.organizationId ?? '');
    return this.workers.listWorkers(unitId, search ?? null, callerRole, organizationId);
  }

  /**
   * Compatibility alias for BFF: GET /nurses/export?unitId=2
   */
  @Roles('HEAD_NURSE')
  @Get('/nurses/export')
  async exportNurses(@Req() req: Request, @Query('unitId') unitId?: string) {
    const targetUnitId = unitId ?? '2';
    const organizationId = String((req as any).user?.organizationId ?? '');
    const result = await this.workers.listWorkers(targetUnitId, null, '', organizationId);
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
   * GET /workers/me/consent
   * Returns the authenticated nurse's Gemini AI consent status.
   * No role restriction — every linked nurse can read their own consent state.
   */
  @Get('/workers/me/consent')
  async getMyConsent(@Req() req: Request) {
    const user = (req as any).user;
    const result = await this.workers.getMyConsentStatus(Number(user.sub));
    if (!result) return { workerId: null, geminiConsentGiven: false, geminiConsentGivenAt: null, geminiConsentDeclinedAt: null };
    return result;
  }

  /**
   * Dashboard KPI summary for donut charts.
   * Optional date filter matches the dashboard window.
   *
   * GET /units/:unitId/kpis/summary?startDate=2026-03-09&endDate=2026-03-15
   */
  @Roles('HEAD_NURSE')
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
