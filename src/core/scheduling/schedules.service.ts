// src/core/scheduling/schedules.service.ts
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';

import { Schedule, ScheduleStatus } from '@/database/entities/scheduling/schedule.entity';
import { ScheduleAssignment } from '@/database/entities/scheduling/schedule-assignment.entity';
import { ShiftTemplate } from '@/database/entities/scheduling/shift-template.entity';
import { Unit } from '@/database/entities/core/unit.entity';
import { User } from '@/database/entities/users/user.entity';

import { CreateScheduleDto } from './dto/create-schedule.dto';
import { PatchAssignmentDto } from './dto/patch-assignment.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedulesRepo: Repository<Schedule>,

    @InjectRepository(ScheduleAssignment)
    private readonly assignmentsRepo: Repository<ScheduleAssignment>,

    @InjectRepository(ShiftTemplate)
    private readonly shiftTemplatesRepo: Repository<ShiftTemplate>,

    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  private async loadShiftTemplatesForUnit(unitId: string) {
    const rows = await this.shiftTemplatesRepo.find({
      where: [{ unit_id: unitId }, { unit_id: IsNull() }],
      order: { code: 'ASC' },
    });

    return rows
      .filter((s) => s.is_active)
      .map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        startTime: s.start_time,
        endTime: s.end_time,
        attributes: s.attributes,
      }));
  }

  async createSchedule(unitId: string, dto: CreateScheduleDto, createdBy: any) {
    if (createdBy === undefined || createdBy === null || String(createdBy).trim() === '') {
      throw new UnauthorizedException('Missing authenticated user id');
    }

    const createdById = String(createdBy);

    if (!/^\d+$/.test(createdById)) {
      throw new BadRequestException('Invalid authenticated user id');
    }

    // Schema requires created_by bigint NOT NULL + FK -> users(id) :contentReference[oaicite:1]{index=1}
    const userExists = await this.usersRepo.exist({
      where: { id: createdById as any },
    });

    if (!userExists) {
      throw new UnauthorizedException('Authenticated user not found in database');
    }

    const unit = await this.unitsRepo.findOne({
      where: { id: unitId as any },
      select: ['id', 'organization_id'],
    });

    if (!unit) throw new NotFoundException('Unit not found');

    const schedule = this.schedulesRepo.create({
      organization_id: unit.organization_id,
      unit_id: unit.id,
      job_id: null,
      name: dto.name,
      start_date: dto.startDate,
      end_date: dto.endDate,
      status: ScheduleStatus.DRAFT,
      constraint_profile_id: dto.constraintProfileId ?? null,
      last_solver_run_id: null,

      // IMPORTANT: must match your entity property naming (snake_case style)
      created_by: createdById,

      published_at: null,
      published_by: null,
      attributes: {},
    });

    const saved = await this.schedulesRepo.save(schedule);

    return {
      schedule: {
        id: saved.id,
        organizationId: saved.organization_id,
        unitId: saved.unit_id,
        name: saved.name,
        startDate: saved.start_date,
        endDate: saved.end_date,
        status: saved.status,
        constraintProfileId: saved.constraint_profile_id,
        jobId: saved.job_id,
        createdAt: saved.created_at.toISOString(),
      },
    };
  }

  async getCurrentSchedule(unitId: string, dateFrom?: string, dateTo?: string) {
    const schedule = await this.schedulesRepo.findOne({
      where: { unit_id: unitId },
      order: { created_at: 'DESC' },
    });

    if (!schedule) {
      throw new NotFoundException('No schedule found for unit');
    }

    const where: any = { schedule_id: schedule.id };
    if (dateFrom && dateTo) {
      where.date = Between(dateFrom, dateTo);
    }

    const assignments = await this.assignmentsRepo.find({
      where,
      order: { date: 'ASC' },
    });

    const shiftTemplates = await this.loadShiftTemplatesForUnit(unitId);

    return {
      schedule: {
        id: schedule.id,
        organizationId: schedule.organization_id,
        unitId: schedule.unit_id,
        name: schedule.name,
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        status: schedule.status,
        jobId: schedule.job_id,
        constraintProfileId: schedule.constraint_profile_id,
        lastSolverRunId: schedule.last_solver_run_id,
        attributes: schedule.attributes,
        createdAt: schedule.created_at.toISOString(),
        publishedAt: schedule.published_at?.toISOString() ?? null,
        publishedBy: schedule.published_by,
      },
      shiftTemplates,
      assignments: assignments.map((a) => ({
        id: a.id,
        workerId: a.worker_id,
        date: a.date,
        shiftCode: a.shift_code,
        source: a.source,
        attributes: a.attributes,
        createdAt: a.created_at.toISOString(),
        updatedAt: a.updated_at.toISOString(),
      })),
    };
  }

  async getScheduleHistory(unitId: string, limit: number) {
    const rows = await this.schedulesRepo.find({
      where: { unit_id: unitId },
      order: { created_at: 'DESC' },
      take: limit,
    });

    return {
      unitId,
      schedules: rows.map((s) => ({
        id: s.id,
        name: s.name,
        startDate: s.start_date,
        endDate: s.end_date,
        status: s.status,
        jobId: s.job_id,
        createdAt: s.created_at.toISOString(),
        publishedAt: s.published_at?.toISOString() ?? null,
      })),
    };
  }

  async getScheduleById(scheduleId: string) {
    const schedule = await this.schedulesRepo.findOne({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const assignments = await this.assignmentsRepo.find({
      where: { schedule_id: schedule.id },
      order: { date: 'ASC' },
    });

    const shiftTemplates = await this.loadShiftTemplatesForUnit(schedule.unit_id);

    return {
      schedule: {
        id: schedule.id,
        organizationId: schedule.organization_id,
        unitId: schedule.unit_id,
        name: schedule.name,
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        status: schedule.status,
        jobId: schedule.job_id,
        constraintProfileId: schedule.constraint_profile_id,
        lastSolverRunId: schedule.last_solver_run_id,
        attributes: schedule.attributes,
        createdAt: schedule.created_at.toISOString(),
        publishedAt: schedule.published_at?.toISOString() ?? null,
        publishedBy: schedule.published_by,
      },
      shiftTemplates,
      assignments: assignments.map((a) => ({
        id: a.id,
        workerId: a.worker_id,
        date: a.date,
        shiftCode: a.shift_code,
        source: a.source,
        attributes: a.attributes,
        createdAt: a.created_at.toISOString(),
        updatedAt: a.updated_at.toISOString(),
      })),
    };
  }

  async patchAssignment(assignmentId: string, dto: PatchAssignmentDto) {
    const a = await this.assignmentsRepo.findOne({ where: { id: assignmentId } });
    if (!a) throw new NotFoundException('Assignment not found');

    a.worker_id = dto.workerId;
    a.date = dto.date;
    a.shift_code = dto.shiftCode;

    a.source = 'MANUAL';
    a.attributes = dto.attributes ?? a.attributes;

    const saved = await this.assignmentsRepo.save(a);

    return {
      assignment: {
        id: saved.id,
        scheduleId: saved.schedule_id,
        workerId: saved.worker_id,
        date: saved.date,
        shiftCode: saved.shift_code,
        source: saved.source,
        attributes: saved.attributes,
        updatedAt: saved.updated_at.toISOString(),
      },
    };
  }

  async exportSchedule(scheduleId: string, format: 'pdf' | 'xlsx') {
    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    return {
      scheduleId: schedule.id,
      format,
      message: 'Export not implemented yet (Phase 1 stub)',
    };
  }
}
