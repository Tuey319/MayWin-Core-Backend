// src/core/unit-config/shift-templates/shift-templates.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { ShiftTemplatesController } from './shift-templates.controller';
import { ShiftTemplatesService } from './shift-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShiftTemplate])],
  controllers: [ShiftTemplatesController],
  providers: [ShiftTemplatesService],
  exports: [ShiftTemplatesService],
})
export class ShiftTemplatesModule {}
