// src/core/unit-config/unit-config.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UnitConfigService } from './unit-config.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class UnitConfigController {
  constructor(private readonly service: UnitConfigService) {}

  /**
   * Purpose:
   * One-call bootstrap for scheduling UI.
   * Returns shift templates, constraint profiles, and coverage rules.
   */
  @Get('/units/:unitId/config')
  getAll(@Param('unitId') unitId: string) {
    return this.service.getFullUnitConfig(unitId);
  }

  /**
   * Purpose:
   * List all active shift templates available to this unit.
   * Includes unit-specific templates + org-wide templates (unit_id = null).
   */
  @Get('/units/:unitId/shift-templates')
  getShiftTemplates(@Param('unitId') unitId: string) {
    return this.service.getShiftTemplates(unitId);
  }

  /**
   * Purpose:
   * List constraint profiles available for scheduling runs.
   */
  @Get('/units/:unitId/constraint-profiles')
  getConstraintProfiles(@Param('unitId') unitId: string) {
    return this.service.getConstraintProfiles(unitId);
  }

  /**
   * Purpose:
   * Coverage rules describing minimum/maximum staffing per shift/day.
   */
  @Get('/units/:unitId/coverage-rules')
  getCoverageRules(@Param('unitId') unitId: string) {
    return this.service.getCoverageRules(unitId);
  }
}
