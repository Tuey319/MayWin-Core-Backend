// src/core/worker-preferences/worker-preferences.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { WorkerPreferencesService } from './worker-preferences.service';
import { GetWorkerPreferencesParams } from './dto/get-worker-preferences.params';
import { PutWorkerPreferencesDto } from './dto/put-worker-preferences.dto';

type JwtCtx = {
  organizationId: number;
  roles: string[];
  unitIds: number[];
};

@UseGuards(JwtAuthGuard)
@Controller()
export class WorkerPreferencesController {
  constructor(private readonly service: WorkerPreferencesService) {}

  private ctx(req: Request): JwtCtx {
    const u = (req as any).user ?? {};
    return {
      organizationId: Number(u.organizationId),
      roles: Array.isArray(u.roles) ? u.roles : [],
      unitIds: Array.isArray(u.unitIds) ? u.unitIds : [],
    };
  }

  /**
   * Purpose:
   * Read worker preferences (UI edit form, solver debug).
   * Returns preferencesByUnit map from worker.attributes.
   *
   * GET /workers/:workerId/preferences
   */
  @Get('/workers/:workerId/preferences')
  get(@Param() p: GetWorkerPreferencesParams) {
    return this.service.getPreferences(p.workerId);
  }

  /**
   * Purpose:
   * Save worker-level preference settings (soft/hard prefs).
   * Replaces preferences for a single unit.
   *
   * PUT /workers/:workerId/preferences
   */
  @Put('/workers/:workerId/preferences')
  put(
    @Param() p: GetWorkerPreferencesParams,
    @Body() dto: PutWorkerPreferencesDto,
  ) {
    return this.service.upsertPreferences(
      p.workerId,
      dto.unitId,
      dto.preferences,
    );
  }

  /**
   * Purpose:
   * Dashboard / admin view.
   * List all workers in a unit with their preferences (if any).
   *
   * GET /units/:unitId/workers/preferences
   */
  @Get('/units/:unitId/workers/preferences')
  listForUnit(
    @Req() req: Request,
    @Param('unitId') unitId: string,
  ) {
    return this.service.listForUnit(this.ctx(req), unitId);
  }
}
