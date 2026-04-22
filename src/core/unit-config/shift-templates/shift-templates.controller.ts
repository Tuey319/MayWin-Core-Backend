// src/core/unit-config/shift-templates/shift-templates.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ShiftTemplatesService } from './shift-templates.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@Roles('ADMIN')
@UseGuards(JwtAuthGuard)
@Controller()
export class ShiftTemplatesController {
  constructor(private readonly service: ShiftTemplatesService) {}

  @Get('/units/:unitId/shift-templates')
  async list(@Param('unitId') unitId: string, @Query('includeInactive') includeInactive?: string) {
    const orgId = await this.service.resolveOrgId(unitId);
    return this.service.list(orgId, unitId, includeInactive === 'true');
  }

  @Post('/units/:unitId/shift-templates')
  async create(@Param('unitId') unitId: string, @Body() dto: CreateShiftTemplateDto) {
    const orgId = await this.service.resolveOrgId(unitId);
    return this.service.create(orgId, unitId, dto);
  }

  @Patch('/units/:unitId/shift-templates/:id')
  async update(
    @Param('unitId') unitId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShiftTemplateDto,
  ) {
    const orgId = await this.service.resolveOrgId(unitId);
    return this.service.update(orgId, unitId, id, dto);
  }

  // soft delete
  @Delete('/units/:unitId/shift-templates/:id')
  async deactivate(@Param('unitId') unitId: string, @Param('id') id: string) {
    const orgId = await this.service.resolveOrgId(unitId);
    return this.service.deactivate(orgId, unitId, id);
  }
}
