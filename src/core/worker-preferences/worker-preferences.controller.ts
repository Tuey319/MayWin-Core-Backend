// src/core/worker-preferences/worker-preferences.controller.ts
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { WorkerPreferencesService } from './worker-preferences.service';
import { GetWorkerPreferencesParams } from './dto/get-worker-preferences.params';
import { PutWorkerPreferencesDto } from './dto/put-worker-preferences.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class WorkerPreferencesController {
  constructor(private readonly service: WorkerPreferencesService) {}

  /**
   * Purpose:
   * Read worker preferences (UI edit form, solver debug).
   * Optional endpoint, but very practical.
   */
  @Get('/workers/:workerId/preferences')
  get(@Param() p: GetWorkerPreferencesParams) {
    return this.service.getPreferences(p.workerId);
  }

  /**
   * Purpose:
   * Save worker-level preference settings (soft/hard prefs).
   * Spec-required:
   * PUT /workers/{workerId}/preferences
   */
  @Put('/workers/:workerId/preferences')
  put(@Param() p: GetWorkerPreferencesParams, @Body() dto: PutWorkerPreferencesDto) {
    return this.service.upsertPreferences(p.workerId, dto.unitId, dto.preferences);
  }
}
