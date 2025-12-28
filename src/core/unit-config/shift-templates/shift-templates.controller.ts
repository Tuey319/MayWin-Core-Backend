// src/core/unit-config/shift-templates/shift-templates.controller.ts
import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ShiftTemplatesService } from './shift-templates.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ShiftTemplatesController {
  constructor(private readonly service: ShiftTemplatesService) {}

  @Post('/units/:unitId/shift-templates')
  create(@Req() req: any, @Param('unitId') unitId: string, @Body() dto: CreateShiftTemplateDto) {
    const orgId = String(req.user?.organizationId);
    return this.service.create(orgId, unitId, dto);
  }

  @Patch('/units/:unitId/shift-templates/:id')
  update(
    @Req() req: any,
    @Param('unitId') unitId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShiftTemplateDto,
  ) {
    const orgId = String(req.user?.organizationId);
    return this.service.update(orgId, unitId, id, dto);
  }

  // soft delete
  @Delete('/units/:unitId/shift-templates/:id')
  deactivate(@Req() req: any, @Param('unitId') unitId: string, @Param('id') id: string) {
    const orgId = String(req.user?.organizationId);
    return this.service.deactivate(orgId, unitId, id);
  }
}
