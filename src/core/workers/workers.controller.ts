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
}
