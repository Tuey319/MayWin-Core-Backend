// src/core/unit-config/coverage-rules/coverage-rules.controller.ts
import { Body, Controller, Delete, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CoverageRulesService } from './coverage-rules.service';
import { CoverageRuleItemDto } from './dto/coverage-rule-item.dto';
import { ReplaceCoverageRulesDto } from './dto/replace-coverage-rules.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class CoverageRulesController {
  constructor(private readonly service: CoverageRulesService) {}

  @Post('/units/:unitId/coverage-rules')
  create(@Param('unitId') unitId: string, @Body() dto: CoverageRuleItemDto) {
    return this.service.create(unitId, dto);
  }

  @Patch('/units/:unitId/coverage-rules/:id')
  update(@Param('unitId') unitId: string, @Param('id') id: string, @Body() dto: CoverageRuleItemDto) {
    return this.service.update(unitId, id, dto);
  }

  @Delete('/units/:unitId/coverage-rules/:id')
  remove(@Param('unitId') unitId: string, @Param('id') id: string) {
    return this.service.remove(unitId, id);
  }

  // bulk replace
  @Put('/units/:unitId/coverage-rules')
  replace(@Param('unitId') unitId: string, @Body() dto: ReplaceCoverageRulesDto) {
    return this.service.replace(unitId, dto);
  }
}
