// src/core/unit-config/constraint-profiles/constraint-profiles.controller.ts
import { Body, Controller, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ConstraintProfilesService } from './constraint-profiles.service';
import { CreateConstraintProfileDto } from './dto/create-constraint-profile.dto';
import { UpdateConstraintProfileDto } from './dto/update-constraint-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ConstraintProfilesController {
  constructor(private readonly service: ConstraintProfilesService) {}

  @Post('/units/:unitId/constraint-profiles')
  create(@Param('unitId') unitId: string, @Body() dto: CreateConstraintProfileDto) {
    return this.service.create(unitId, dto);
  }

  @Patch('/units/:unitId/constraint-profiles/:id')
  update(@Param('unitId') unitId: string, @Param('id') id: string, @Body() dto: UpdateConstraintProfileDto) {
    return this.service.update(unitId, id, dto);
  }

  @Post('/units/:unitId/constraint-profiles/:id/activate')
  activate(
    @Param('unitId') unitId: string,
    @Param('id') id: string,
    @Query('deactivateOthers') deactivateOthers?: string,
  ) {
    const flag = deactivateOthers === undefined ? true : deactivateOthers !== 'false';
    return this.service.activate(unitId, id, flag);
  }
}
