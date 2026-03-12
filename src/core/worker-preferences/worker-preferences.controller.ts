// src/core/worker-preferences/worker-preferences.controller.ts
import {
  Body,
  Controller,
  Delete,
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

    /**
     * Nurse requests schedule based on preferences.
     * Stores preferences and triggers scheduling engine.
     * PUT /workers/:workerId/request-schedule
     */
    @Put('/workers/:workerId/request-schedule')
    async requestSchedule(
      @Param() p: GetWorkerPreferencesParams,
      @Body() dto: PutWorkerPreferencesDto,
      @Req() req: Request,
    ) {
      // Store preferences
      const result = await this.service.upsertPreferences(
        p.workerId,
        dto.unitId,
        dto.preferences,
      );

      // Trigger scheduling engine (stub for now)
      // TODO: Integrate with jobs.service to create a job and enqueue
      // Example: await jobsService.createJob(...)

      return {
        message: 'Preferences saved and scheduling triggered.',
        result,
      };
    }

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
   * Delete all preferences for a worker.
   *
   * DELETE /workers/:workerId/preferences
   */
  @Delete('/workers/:workerId/preferences')
  deletePreferences(@Param() p: GetWorkerPreferencesParams) {
    return this.service.deletePreferences(p.workerId);
  }

  /**
   * Purpose:
   * Remove a single date entry from a worker's preference_pattern_json (reject a request).
   *
   * DELETE /workers/:workerId/preferences/requests/:date
   */
  @Delete('/workers/:workerId/preferences/requests/:date')
  deletePreferenceRequest(
    @Param() p: GetWorkerPreferencesParams,
    @Param('date') date: string,
  ) {
    return this.service.deletePreferenceRequest(p.workerId, date);
  }

  /**
   * Purpose:
   * Dashboard / admin view.
   * List all workers in a unit with their preferences (if any).
   *
   * GET /units/:unitId/workers/preferences
   */
  @Get('/units/:unitId/workers/preferences')
  async listForUnit(
    @Req() req: Request,
    @Param('unitId') unitId: string,
  ) {
    const result = await this.service.listForUnit(this.ctx(req), unitId);
    return { workerPreferences: result };
  }
}
