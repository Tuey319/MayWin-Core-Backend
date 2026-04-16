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
  ) { }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async buildContext(userId: string) {
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

    // 3) Merge + dedupe
    const roles = Array.from(new Set([...globalRoleCodes, ...unitRoleCodes])).sort();

    return { unitIds, roles };
  }

  private signFull(user: User, roles: string[], unitIds: number[]) {
    const payload: JwtPayload = {
      sub: Number(user.id),
      email: user.email,
      fullName: user.full_name,
      organizationId: Number(user.organization_id),
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

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // OTP bypass: set AUTH_DISABLE_OTP=true to skip 2FA and return JWT directly
    if ((process.env.AUTH_DISABLE_OTP ?? '').toLowerCase() === 'true') {
      const { unitIds, roles } = await this.buildContext(user.id);
      const accessToken = this.signFull(user, roles, unitIds);
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

    // Send email (non-blocking fail OK in dev if no SMTP configured)
    try {
      await this.mailService.sendOtp(user.email, user.full_name, otp);
    } catch (err: any) {
      const isProduction = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
      const allowDevFallback = (
        process.env.AUTH_ALLOW_OTP_LOG_FALLBACK ?? (!isProduction).toString()
      ).toLowerCase() === 'true';

      if (!allowDevFallback) {
        this.logger.error(`[AUTH] Failed to deliver OTP to ${user.email}`);
        throw new ServiceUnavailableException(
          'Unable to send verification code right now. Please try again later.',
        );
      }

      this.logger.warn(
        `[AUTH] Could not send OTP email. DEV fallback OTP for ${user.email}: ${otp}`,
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

    if (record.otp_code !== otp.trim()) {
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

    const { unitIds, roles } = await this.buildContext(user.id);
    const accessToken = this.signFull(user, roles, unitIds);

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

    const { unitIds, roles } = await this.buildContext(saved.id);
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

  async logout(_jwtUser: any, _dto: { deviceId?: string }) {
    return { ok: true };
  }
}
