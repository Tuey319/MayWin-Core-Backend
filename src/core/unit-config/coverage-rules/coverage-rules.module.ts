// src/core/unit-config/coverage-rules/coverage-rules.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoverageRule } from '@/database/entities/scheduling/coverage-rule.entity';
import { CoverageRulesController } from './coverage-rules.controller';
import { CoverageRulesService } from './coverage-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoverageRule])],
  controllers: [CoverageRulesController],
  providers: [CoverageRulesService],
  exports: [CoverageRulesService],
})
export class CoverageRulesModule {}
