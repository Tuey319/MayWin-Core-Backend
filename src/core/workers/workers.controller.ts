// src/core/workers/workers.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

    return {
      nurses: (result.workers ?? []).map((w) => ({
        id: Number(w.id),
        name: w.fullName,
        level: null,
        employment_type: w.employmentType,
        unit: targetUnitId,
        satisfaction: null,
      })),
    };
  }
}
