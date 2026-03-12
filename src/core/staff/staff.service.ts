import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStaffDto } from './dto/create-staff.dto';
import { PatchStaffDto } from './dto/patch-staff.dto';
import { AuditLogsService } from '@/core/audit-logs/audit-logs.service';
import { EmploymentType, Worker } from '@/database/entities/workers/worker.entity';

type StaffRow = {
  id: string;
  name: string;
  employeeId: string;
  lineId: string;
  position: 'nurse' | 'scheduler' | 'admin';
  email: string;
  status: 'active' | 'inactive';
};

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Worker)
    private readonly workersRepo: Repository<Worker>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private mapWorkerToStaff(worker: Worker): StaffRow {
    const attrs = (worker.attributes ?? {}) as Record<string, any>;

    return {
      id: worker.id,
      name: worker.full_name,
      employeeId: worker.worker_code ?? '',
      lineId: worker.line_id ?? '',
      position: (attrs.position as StaffRow['position']) ?? 'nurse',
      email: (attrs.email as string) ?? '',
      status: worker.is_active ? 'active' : 'inactive',
    };
  }

  private mapPositionToEmploymentType(position: StaffRow['position']): EmploymentType {
    if (position === 'nurse') return EmploymentType.FULL_TIME;
    if (position === 'scheduler') return EmploymentType.PART_TIME;
    return EmploymentType.CONTRACT;
  }

  async list(organizationId: number) {
    const workers = await this.workersRepo.find({
      where: { organization_id: String(organizationId) as any },
      order: { id: 'ASC' },
    });

    const staff = workers.map((w) => this.mapWorkerToStaff(w));
    return {
      ok: true,
      staff,
    };
  }

  private validateId(id: string) {
    if (!/^\d+$/.test(id)) throw new NotFoundException('Staff not found');
  }

  async getById(id: string, organizationId: number) {
    this.validateId(id);
    const worker = await this.workersRepo.findOne({
      where: {
        id: id as any,
        organization_id: String(organizationId) as any,
      },
    });
    if (!worker) throw new NotFoundException('Staff not found');

    const found = this.mapWorkerToStaff(worker);

    return {
      ok: true,
      staff: found,
    };
  }

  async create(
    dto: CreateStaffDto,
    actor: { actorId: string; actorName: string },
    context: { organizationId: number; unitId: number | null },
  ) {
    if (!dto.name || !dto.employeeId || !dto.lineId || !dto.position || !dto.email) {
      throw new BadRequestException('Missing required staff fields');
    }

    const exists = await this.workersRepo.findOne({
      where: {
        organization_id: String(context.organizationId) as any,
        worker_code: dto.employeeId,
      },
    });

    if (exists) {
      throw new BadRequestException('employeeId already exists');
    }

    const worker = this.workersRepo.create({
      organization_id: String(context.organizationId),
      primary_unit_id: context.unitId != null ? String(context.unitId) : null,
      full_name: dto.name,
      worker_code: dto.employeeId,
      employment_type: this.mapPositionToEmploymentType(dto.position),
      weekly_hours: null,
      line_id: dto.lineId,
      is_active: (dto.status ?? 'active') === 'active',
      linked_user_id: null,
      attributes: {
        email: dto.email,
        position: dto.position,
      },
    });

    const saved = await this.workersRepo.save(worker);
    const created = this.mapWorkerToStaff(saved);

    await this.auditLogs.append({
      actorId: actor.actorId,
      actorName: actor.actorName,
      action: 'CREATE_STAFF',
      targetType: 'staff',
      targetId: created.employeeId,
      detail: `Created staff ${created.name} (${created.employeeId})`,
    });

    return {
      ok: true,
      staff: created,
    };
  }

  async patch(
    id: string,
    dto: PatchStaffDto,
    actor: { actorId: string; actorName: string },
    organizationId: number,
  ) {
    this.validateId(id);
    const worker = await this.workersRepo.findOne({
      where: {
        id: id as any,
        organization_id: String(organizationId) as any,
      },
    });

    if (!worker) throw new NotFoundException('Staff not found');

    if (dto.name != null) worker.full_name = dto.name;
    if (dto.employeeId != null) worker.worker_code = dto.employeeId;
    if (dto.lineId != null) worker.line_id = dto.lineId;
    if (dto.status != null) worker.is_active = dto.status === 'active';

    const attrs = { ...(worker.attributes ?? {}) };
    if (dto.email != null) attrs.email = dto.email;
    if (dto.position != null) {
      attrs.position = dto.position;
      worker.employment_type = this.mapPositionToEmploymentType(dto.position);
    }
    worker.attributes = attrs;

    const saved = await this.workersRepo.save(worker);
    const updated = this.mapWorkerToStaff(saved);

    await this.auditLogs.append({
      actorId: actor.actorId,
      actorName: actor.actorName,
      action: 'UPDATE_STAFF',
      targetType: 'staff',
      targetId: updated.employeeId,
      detail: `Updated staff ${updated.name} (${updated.employeeId})`,
    });

    return {
      ok: true,
      staff: updated,
    };
  }

  async remove(id: string, actor: { actorId: string; actorName: string }, organizationId: number) {
    this.validateId(id);
    const worker = await this.workersRepo.findOne({
      where: {
        id: id as any,
        organization_id: String(organizationId) as any,
      },
    });

    if (!worker) throw new NotFoundException('Staff not found');

    const removed = this.mapWorkerToStaff(worker);
    await this.workersRepo.remove(worker);

    await this.auditLogs.append({
      actorId: actor.actorId,
      actorName: actor.actorName,
      action: 'DELETE_STAFF',
      targetType: 'staff',
      targetId: removed.employeeId,
      detail: `Deleted staff ${removed.name} (${removed.employeeId})`,
    });

    return {
      ok: true,
    };
  }
}
