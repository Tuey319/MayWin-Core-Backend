// src/core/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';

import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { UserRole } from '@/database/entities/users/user-role.entity';
import { Role } from '@/database/entities/core/role.entity';
import { AuthOtp } from '@/database/entities/users/auth-otp.entity';
import { Worker, EmploymentType } from '@/database/entities/workers/worker.entity';
import { JwtPayload } from './types/jwt-payload';
import { SignupDto } from './dto/signup.dto';
import { MailService } from '@/core/mail/mail.service';
import { AuditLogsService } from '@/core/audit-logs/audit-logs.service';
import { TokenBlocklistService } from './token-blocklist.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UnitMembership)
    private readonly unitMembershipRepo: Repository<UnitMembership>,

    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    @InjectRepository(AuthOtp)
    private readonly otpRepo: Repository<AuthOtp>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly auditLogs: AuditLogsService,
    private readonly blocklist: TokenBlocklistService,
  ) { }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async buildContext(userId: string, userAttributes: Record<string, any> = {}) {
    // 1) Unit memberships (unit-scoped roles)
    const memberships = await this.unitMembershipRepo.find({
      where: { user_id: String(userId) },
    });

    const unitIds = memberships.map((m) => Number(m.unit_id));
    const unitRoleCodes = memberships
      .map((m) => (m.role_code ?? '').trim())
      .filter(Boolean);

    // 2) Global roles (user_roles -> roles) WITHOUT JOIN
    const userRoleRows = await this.userRoleRepo.find({
      where: { user_id: String(userId) },
    });

    const roleIds = userRoleRows.map((ur) => String(ur.role_id)).filter(Boolean);

    let globalRoleCodes: string[] = [];
    if (roleIds.length) {
      const roleRows = await this.roleRepo.find({
        where: { id: In(roleIds) },
      });
      globalRoleCodes = roleRows
        .map((r: any) => (r.code ?? '').trim())
        .filter(Boolean);
    }

    // 3) Include role_hint from user.attributes as a fallback role source.
    //    Super_admin and other accounts created without unit_memberships / user_roles
    //    entries would otherwise end up with roles: [] in the JWT, losing their role.
    const hintRaw = String(userAttributes?.role_hint ?? '').trim();
    if (hintRaw) {
      globalRoleCodes.push(hintRaw);
    }

    // 4) Merge + dedupe
    const roles = Array.from(new Set([...globalRoleCodes, ...unitRoleCodes])).sort();

    return { unitIds, roles };
  }

  private signFull(user: User, roles: string[], unitIds: number[]) {
    const orgId = Number(user.organization_id);

    // organization_id = NULL in the DB produces orgId = 0 here. For normal users this
    // means every org-scoped query (staff, schedules, …) returns nothing. Super_admin
    // accounts are handled by a bypass in staff.service, but other services are not.
    // Fix: set organization_id on this user row in the DB.
    if (!orgId || orgId === 0) {
      this.logger.warn(
        `[AUTH] User ${user.email} (id=${user.id}) has no organization_id set. ` +
        `Org-scoped queries will return empty results. Set organization_id in the users table.`,
      );
    }

    const payload: JwtPayload = {
      sub: Number(user.id),
      email: user.email,
      fullName: user.full_name,
      organizationId: orgId,
      roles,
      unitIds,
    };
    return this.jwtService.sign(payload);
  }

  /** Short-lived token flagging that password was verified but OTP not yet entered */
  private signPending(userId: string): string {
    return this.jwtService.sign(
      { type: 'OTP_PENDING', sub: userId },
      { expiresIn: '10m' },
    );
  }

  // Cryptographically secure 6-digit OTP (ISO 27001 A.10.1.1)
  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  // ── Auth flows ───────────────────────────────────────────────────────────

  /**
   * Step 1: validate credentials → send OTP email
   * Returns { requires2FA: true, otpToken } — NOT the real JWT yet
   */
  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({
      where: { email, is_active: true },
    });

    if (!user) {
      // PDPA §27, ISO 27001:2022 A.8.15 — log failed login attempt (no user details)
      await this.auditLogs.append({ orgId: 'unknown', actorId: 'anonymous', actorName: email,
        action: 'LOGIN_FAILED', targetType: 'user', targetId: email,
        detail: 'User not found' }).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      // PDPA §27, ISO 27001:2022 A.8.15 — log failed login attempt
      await this.auditLogs.append({ orgId: String(user.organization_id ?? 'unknown'), actorId: String(user.id), actorName: user.email,
        action: 'LOGIN_FAILED', targetType: 'user', targetId: String(user.id),
        detail: 'Invalid password' }).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate + persist OTP (invalidate any existing unused ones)
    await this.otpRepo.delete({ user_id: user.id, used_at: IsNull() });

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.otpRepo.save(
      this.otpRepo.create({
        user_id: user.id,
        otp_code: otp,
        expires_at: expiresAt,
        used_at: null,
      }),
    );

    // Send OTP email — fail hard if SMTP is unavailable (ISO 27001 A.9.4.2)
    try {
      await this.mailService.sendOtp(user.email, user.full_name, otp);
    } catch {
      this.logger.error(`[AUTH] Failed to deliver OTP to ${user.email}`);
      throw new ServiceUnavailableException(
        'Unable to send verification code right now. Please try again later.',
      );
    }

    return {
      requires2FA: true,
      otpToken: this.signPending(user.id),
    };
  }

  /**
   * Step 2: validate OTP + pending token → return real JWT
   */
  async verifyOtp(otpToken: string, otp: string) {
    // Validate the pending token
    let payload: any;
    try {
      payload = this.jwtService.verify(otpToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired session. Please log in again.');
    }

    if (payload?.type !== 'OTP_PENDING' || !payload?.sub) {
      throw new UnauthorizedException('Invalid token type');
    }

    const userId = String(payload.sub);

    // Find the OTP record
    const record = await this.otpRepo.findOne({
      where: { user_id: userId, used_at: IsNull() },
      order: { created_at: 'DESC' },
    });

    if (!record) {
      throw new UnauthorizedException('No pending verification found. Please log in again.');
    }

    if (record.expires_at < new Date()) {
      throw new UnauthorizedException('Verification code has expired. Please log in again.');
    }

    // Timing-safe OTP comparison to prevent timing attacks (ISO 27001 A.10.1.1)
    const provided = Buffer.from(otp.trim().padEnd(record.otp_code.length));
    const expected = Buffer.from(record.otp_code);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Incorrect verification code');
    }

    // Mark as used
    record.used_at = new Date();
    await this.otpRepo.save(record);

    // Load the user + issue real JWT
    const user = await this.userRepo.findOne({
      where: { id: userId as any, is_active: true },
    });

    if (!user) throw new UnauthorizedException('Account not found');

    const { unitIds, roles } = await this.buildContext(user.id, user.attributes ?? {});
    const accessToken = this.signFull(user, roles, unitIds);

    // PDPA §27, ISO 27001:2022 A.8.15 — log successful authentication
    await this.auditLogs.append({ orgId: String(user.organization_id ?? 'unknown'), actorId: String(user.id), actorName: user.email,
      action: 'LOGIN_SUCCESS', targetType: 'user', targetId: String(user.id),
      detail: 'OTP verified — session issued' }).catch(() => {});

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        organizationId: Number(user.organization_id),
        roles,
        unitIds,
      },
    };
  }

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();

    const exists = await this.userRepo.findOne({ where: { email } });
    if (exists) throw new BadRequestException('Email already exists');

    if (!dto.organizationId) {
      throw new BadRequestException('organizationId is required for signup (for now)');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      organization_id: String(dto.organizationId),
      email,
      password_hash: passwordHash,
      full_name: dto.fullName,
      is_active: true,
      attributes: dto.attributes ?? {},
    });

    const saved = await this.userRepo.save(user);

    // optional: attach membership immediately
    if (dto.unitId) {
      const roleCode = (dto.roleCode ?? 'NURSE').trim();

      const existingMembership = await this.unitMembershipRepo.findOne({
        where: { unit_id: String(dto.unitId), user_id: saved.id },
      });

      if (!existingMembership) {
        const membership = this.unitMembershipRepo.create({
          unit_id: String(dto.unitId),
          user_id: saved.id,
          role_code: roleCode,
        });
        await this.unitMembershipRepo.save(membership);
      }

      // Auto-create a Worker (scheduling entity) so this account can be included
      // in schedule containers immediately without a separate staff-creation step.
      const existingWorker = await this.workerRepo.findOne({
        where: { linked_user_id: saved.id as any },
      });
      if (!existingWorker) {
        await this.workerRepo.save(
          this.workerRepo.create({
            organization_id: String(dto.organizationId),
            primary_unit_id: String(dto.unitId),
            full_name: dto.fullName,
            worker_code: `U${saved.id}`,
            employment_type: EmploymentType.FULL_TIME,
            linked_user_id: saved.id,
            is_active: true,
            attributes: { email, position: 'nurse', auto_created: true },
          }),
        );
      }
    }

    const { unitIds, roles } = await this.buildContext(saved.id, saved.attributes ?? {});
    const accessToken = this.signFull(saved, roles, unitIds);

    return {
      accessToken,
      user: {
        id: saved.id,
        email: saved.email,
        fullName: saved.full_name,
        organizationId: Number(saved.organization_id),
        roles,
        unitIds,
      },
    };
  }

  async patchUsername(userId: string, fullName: string) {
    const user = await this.userRepo.findOne({ where: { id: userId as any, is_active: true } });
    if (!user) throw new UnauthorizedException('Account not found');

    user.full_name = fullName.trim();
    const saved = await this.userRepo.save(user);

    return { user: { id: saved.id, email: saved.email, fullName: saved.full_name } };
  }

  // ISO 27001:2022 A.9.4.2 — add token to Redis blocklist for remainder of its TTL
  async logout(jwtUser: any, _dto: { deviceId?: string }) {
    const sub: number = jwtUser?.sub;
    const iat: number = jwtUser?.iat;
    const exp: number = jwtUser?.exp;
    if (sub && iat && exp) {
      await this.blocklist.block(sub, iat, exp);
    }
    return { ok: true };
  }
}
