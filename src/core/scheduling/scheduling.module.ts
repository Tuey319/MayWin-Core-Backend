import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Schedule } from '@/database/entities/scheduling/schedule.entity';
import { ScheduleAssignment } from '@/database/entities/scheduling/schedule-assignment.entity';
import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { Unit } from '@/database/entities/core/unit.entity';

import { SchedulesController } from './schedules.controller';
import { ScheduleAssignmentsController } from './schedule-assignments.controller';
import { SchedulesService } from './schedules.service';
import { User } from '@/database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, ScheduleAssignment, ShiftTemplate, Unit, User])],
  controllers: [SchedulesController, ScheduleAssignmentsController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
