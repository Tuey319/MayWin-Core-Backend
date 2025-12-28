// src/core/unit-config/constraint-profiles/constraint-profiles.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConstraintProfile } from '@/database/entities/scheduling/constraint-profile.entity';
import { ConstraintProfilesController } from './constraint-profiles.controller';
import { ConstraintProfilesService } from './constraint-profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConstraintProfile])],
  controllers: [ConstraintProfilesController],
  providers: [ConstraintProfilesService],
  exports: [ConstraintProfilesService],
})
export class ConstraintProfilesModule {}
