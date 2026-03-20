// src/core/organizations/organizations.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '@/database/entities/core/organization.entity';
import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { ScheduleContainersService } from './schedule-containers.service';
import { ConstraintProfilesModule } from '../unit-config/constraint-profiles/constraint-profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Schedule]),
    ConstraintProfilesModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, ScheduleContainersService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
