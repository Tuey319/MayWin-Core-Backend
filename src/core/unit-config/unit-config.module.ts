// src/core/unit-config/unit-config.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';
import { CoverageRule } from '@/database/entities/scheduling/coverage-rule.entity';

import { UnitConfigController } from './unit-config.controller';
import { UnitConfigService } from './unit-config.service';

import { ShiftTemplatesModule } from './shift-templates/shift-templates.module';
import { ConstraintProfilesModule } from './constraint-profiles/constraint-profiles.module';
import { CoverageRulesModule } from './coverage-rules/coverage-rules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShiftTemplate, ConstraintProfile, CoverageRule]),
    ShiftTemplatesModule,
    ConstraintProfilesModule,
    CoverageRulesModule,
  ],
  controllers: [UnitConfigController],
  providers: [UnitConfigService],
  exports: [UnitConfigService],
})
export class UnitConfigModule {}
