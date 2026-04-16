// src/core/staff/staff.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateStaffDto } from './dto/create-staff.dto';
import { PatchStaffDto } from './dto/patch-staff.dto';
import { AuditLogsService } from '@/core/audit-logs/audit-logs.service';
import { MailService } from '@/core/mail/mail.service';
import { EmploymentType, Worker } from '@/database/entities/workers/worker.entity';
import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { LineLinkToken } from '@/database/entities/workers/line-link-token.entity';

type StaffRow = {
  id: string;
  userId: string | null;
  name: string;
  employeeId: string;
  lineId: string;
  position: 'nurse' | 'head_nurse' | 'scheduler' | 'admin';
  email: string;
  status: 'active' | 'inactive';
  hasWebAccount: boolean;
};

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Worker)
    private readonly workersRepo: Repository<Worker>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UnitMembership)
    private readonly membershipRepo: Repository<UnitMembership>,
    @InjectRepository(LineLinkToken)
    private readonly lineLinkTokenRepo: Repository<LineLinkToken>,
    private readonly auditLogs: AuditLogsService,
    private readonly mailService: MailService,
  ) { }

  // ── Mapping ───────────────────────────────────────────────────────────────

  private mapWorkerToStaff(worker: Worker): StaffRow {
    const attrs = (worker.attributes ?? {}) as Record<string, any>;
    return {
      id: worker.id,
      userId: worker.linked_user_id ?? null,
      name: worker.full_name,
      employeeId: worker.worker_code ?? '',
      lineId: worker.line_id ?? '',
      position: (attrs.position as StaffRow['position']) ?? 'nurse',
      email: (attrs.email as string) ?? '',
      status: worker.is_active ? 'active' : 'inactive',
      hasWebAccount: !!worker.linked_user_id,
    };
  }

  private mapPositionToEmploymentType(position: StaffRow['position']): EmploymentType {
    if (position === 'nurse') return EmploymentType.FULL_TIME;
    if (position === 'head_nurse') return EmploymentType.FULL_TIME;
    if (position === 'scheduler') return EmploymentType.PART_TIME;
    return EmploymentType.CONTRACT;
  }

  private mapPositionToRoleCode(position: StaffRow['position']): string {
    const map: Record<string, string> = {
      nurse: 'NURSE',
      head_nurse: 'UNIT_MANAGER',
      scheduler: 'UNIT_MANAGER',
      admin: 'ORG_ADMIN',
    };
    return map[position] ?? 'NURSE';
  }

  /** Generates a random temporary password: e.g. "Mw@8k3xP" */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const special = '@#!';
    let pass = '';
    for (let i = 0; i < 6; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    pass += special[Math.floor(Math.random() * special.length)];
    pass += Math.floor(Math.random() * 10).toString();
    return pass;
  }

  /** Generates a 6-char uppercase alphanumeric invite token string, e.g. "A3X9K2" */
  private generateTokenString(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no confusable chars (0,O,I,1)
    let token = '';
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validateId(id: string) {
    if (!/^\d+$/.test(id)) throw new NotFoundException('Staff not found');
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(organizationId: number) {
    const workers = await this.workersRepo.find({
      where: { organization_id: String(organizationId) as any },
      order: { id: 'ASC' },
    });
    return { ok: true, staff: workers.map((w) => this.mapWorkerToStaff(w)) };
  }

  async getById(id: string, organizationId: number) {
    this.validateId(id);
    const worker = await this.workersRepo.findOne({
      where: { id: id as any, organization_id: String(organizationId) as any },
    });
    if (!worker) throw new NotFoundException('Staff not found');
    return { ok: true, staff: this.mapWorkerToStaff(worker) };
  }

  /**
   * Create staff = create Worker + User (web login) + link them + assign unit role.
   * Sends a welcome email with temporary password.
   */
  async create(
    dto: CreateStaffDto,
    actor: { actorId: string; actorName: string },
    context: { organizationId: number; unitId: number | null },
  ) {
    if (!dto.name || !dto.employeeId || !dto.position || !dto.email) {
      throw new BadRequestException('name, employeeId, position, email are required');
    }

    const email = dto.email.trim().toLowerCase();

    // Guard: employee ID unique per org
    const exists = await this.workersRepo.findOne({
      where: {
        organization_id: String(context.organizationId) as any,
        worker_code: dto.employeeId,
      },
    });
    if (exists) throw new BadRequestException('employeeId already exists in this organisation');

    // Guard: email unique in users table
    const userExists = await this.userRepo.findOne({ where: { email } });
    if (userExists) throw new BadRequestException('An account with this email already exists');

    // 1. Generate temp password + create User
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.userRepo.save(
      this.userRepo.create({
        organization_id: String(context.organizationId),
        email,
        password_hash: passwordHash,
        full_name: dto.name,
        is_active: true,
        attributes: { role_hint: dto.position },
      }),
    );

    // 2. Create Worker record linked to the User
    const unitId = dto.unitId != null ? dto.unitId : context.unitId;
    const worker = await this.workersRepo.save(
      this.workersRepo.create({
        organization_id: String(context.organizationId),
        primary_unit_id: unitId != null ? String(unitId) : null,
        full_name: dto.name,
        worker_code: dto.employeeId,
        employment_type: this.mapPositionToEmploymentType(dto.position),
        weekly_hours: null,
        line_id: dto.lineId?.trim() || null,
        is_active: (dto.status ?? 'active') === 'active',
        linked_user_id: user.id,
        attributes: { email, position: dto.position },
      }),
    );

    // 3. Assign role in unit_memberships (per-unit role)
    if (unitId != null) {
      const existingMembership = await this.membershipRepo.findOne({
        where: { unit_id: String(unitId), user_id: user.id },
      });
      if (!existingMembership) {
        await this.membershipRepo.save(
          this.membershipRepo.create({
            unit_id: String(unitId),
            user_id: user.id,
            role_code: this.mapPositionToRoleCode(dto.position),
          }),
        );
      }
    }

    // 4. Send welcome email (non-blocking)
    this.mailService.sendWelcome(email, dto.name, tempPassword).catch((err) => {
      console.warn(`[STAFF] Welcome email failed for ${email}:`, err?.message);
    });

    const created = this.mapWorkerToStaff(worker);

    await this.auditLogs.append({
      actorId: actor.actorId,
      actorName: actor.actorName,
      action: 'CREATE_STAFF',
      targetType: 'staff',
      targetId: created.employeeId,
      detail: `Created ${dto.position} ${dto.name} (${email}) with web account`,
    });

    return { ok: true, staff: created };
  }

  async patch(
    id: string,
    dto: PatchStaffDto,
    actor: { actorId: string; actorName: string },
    organizationId: number,
  ) {
    this.validateId(id);
    const worker = await this.workersRepo.findOne({
      where: { id: id as any, organization_id: String(organizationId) as any },
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
      worker.employment_type = this.mapPositionToEmploymentType(dto.position as any);
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

    return { ok: true, staff: updated };
  }

  async remove(id: string, actor: { actorId: string; actorName: string }, organizationId: number) {
    this.validateId(id);
    const worker = await this.workersRepo.findOne({
      where: { id: id as any, organization_id: String(organizationId) as any },
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

    return { ok: true };
  }

  // ── Link User Account ─────────────────────────────────────────────────────

  async linkUser(
    workerId: string,
    userId: number,
    organizationId: number,
    actor: { actorId: string; actorName: string },
  ) {
    this.validateId(workerId);
    const worker = await this.workersRepo.findOne({
      where: { id: workerId as any, organization_id: String(organizationId) as any },
    });
    if (!worker) throw new NotFoundException('Staff not found');

    const user = await this.userRepo.findOne({
      where: { id: String(userId) as any, organization_id: String(organizationId) as any },
    });
    if (!user) throw new NotFoundException('User not found');

    worker.linked_user_id = String(userId);
    const saved = await this.workersRepo.save(worker);

    await this.auditLogs.append({
      actorId: actor.actorId,
      actorName: actor.actorName,
      action: 'LINK_USER',
      targetType: 'staff',
      targetId: saved.worker_code ?? workerId,
      detail: `Linked user ${userId} to worker ${workerId} (${saved.full_name})`,
    });

    return { ok: true, staff: this.mapWorkerToStaff(saved) };
  }

  // ── Create Web Account for existing worker ───────────────────────────────

  /**
   * Create a web login account for an existing worker that has no linked user.
   * Generates a temp password, creates the User, links it to the worker,
   * assigns the unit role, and sends a welcome email.
   */
  async createWebAccount(
    workerId: string,
    organizationId: number,
    actor: { actorId: string; actorName: string },
  ) {
    this.validateId(workerId);

    const worker = await this.workersRepo.findOne({
      where: { id: workerId as any, organization_id: String(organizationId) as any },
    });
    if (!worker) throw new NotFoundException('Staff not found');

    if (worker.linked_user_id) {
      throw new BadRequestException('This worker already has a linked web account');
    }

    const attrs = (worker.attributes ?? {}) as Record<string, any>;
    const email = (attrs.email as string | undefined)?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException(
        'Worker has no email on record. Update the staff email first.',
      );
    }

    const emailTaken = await this.userRepo.findOne({ where: { email } });
    if (emailTaken) {
      throw new BadRequestException('An account with this email already exists');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.userRepo.save(
      this.userRepo.create({
        organization_id: String(organizationId),
        email,
        password_hash: passwordHash,
        full_name: worker.full_name,
        is_active: true,
        attributes: { role_hint: attrs.position ?? 'nurse' },
      }),
    );

    worker.linked_user_id = user.id;
    const saved = await this.workersRepo.save(worker);

    if (worker.primary_unit_id) {
      const existingMembership = await this.membershipRepo.findOne({
        where: { unit_id: String(worker.primary_unit_id), user_id: user.id },
      });
      if (!existingMembership) {
        await this.membershipRepo.save(
          this.membershipRepo.create({
            unit_id: String(worker.primary_unit_id),
            user_id: user.id,
            role_code: this.mapPositionToRoleCode((attrs.position ?? 'nurse') as any),
          }),
        );
      }
    }

    this.mailService.sendWelcome(email, worker.full_name, tempPassword).catch((err) => {
      console.warn(`[STAFF] Welcome email failed for ${email}:`, err?.message);
    });

    await this.auditLogs.append({
      actorId: actor.actorId,
      actorName: actor.actorName,
      action: 'CREATE_WEB_ACCOUNT',
      targetType: 'staff',
      targetId: worker.worker_code ?? workerId,
      detail: `Created web account for ${worker.full_name} (${email})`,
    });

    return { ok: true, staff: this.mapWorkerToStaff(saved) };
  }

  // ── LINE Link Token ───────────────────────────────────────────────────────

  /**
   * Generate a one-time invite code for linking a nurse's LINE account.
   * Expires in 48 hours. Any previous unused token for this worker is invalidated.
   */
  async generateLinkToken(
    workerId: string,
    organizationId: number,
    actor: { actorId: string; actorName: string },
  ) {
    this.validateId(workerId);
    const worker = await this.workersRepo.findOne({
      where: { id: workerId as any, organization_id: String(organizationId) as any },
    });
    if (!worker) throw new NotFoundException('Staff not found');

    // Invalidate old unused tokens for this worker by marking them used
    const oldTokens = await this.lineLinkTokenRepo.find({
      where: { worker_id: workerId, used_at: IsNull() },
    });
    if (oldTokens.length > 0) {
      for (const t of oldTokens) {
        t.used_at = new Date();
      }
      await this.lineLinkTokenRepo.save(oldTokens);
    }

    // Generate new token (retry on collision — extremely unlikely)
    let token: string = this.generateTokenString();
    let attempts = 0;
    while (attempts < 5) {
      const collision = await this.lineLinkTokenRepo.findOne({ where: { token } });
      if (!collision) break;
      token = this.generateTokenString();
      attempts++;
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const saved = await this.lineLinkTokenRepo.save(
      this.lineLinkTokenRepo.create({
        worker_id: workerId,
        token,
        expires_at: expiresAt,
        used_at: null,
      }),
    );

    await this.auditLogs.append({
      actorId: actor.actorId,
      actorName: actor.actorName,
      action: 'GENERATE_LINE_TOKEN',
      targetType: 'staff',
      targetId: worker.worker_code ?? workerId,
      detail: `Generated LINE link token for ${worker.full_name}, expires ${expiresAt.toISOString()}`,
    });

    return {
      ok: true,
      token: saved.token,
      expiresAt: saved.expires_at,
      workerName: worker.full_name,
      instruction: `พิมพ์ในไลน์: ลงทะเบียน: ${saved.token}`,
    };
  }
}
