// src/core/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { UserRole } from '@/database/entities/users/user-role.entity';
import { JwtPayload } from './types/jwt-payload';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UnitMembership)
    private readonly unitMembershipRepo: Repository<UnitMembership>,

    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,

    private readonly jwtService: JwtService,
  ) {}

  private async buildContext(userId: string) {
    const memberships = await this.unitMembershipRepo.find({
      where: { user_id: userId },
    });

    const unitIds = memberships.map((m) => Number(m.unit_id));
    const roles = [...new Set(memberships.map((m) => m.role_code))];

    return { unitIds, roles };
  }

  private sign(user: User, roles: string[], unitIds: number[]) {
    const payload: JwtPayload = {
      sub: Number(user.id),
      organizationId: Number(user.organization_id),
      roles,
      unitIds,
    };

    return this.jwtService.sign(payload);
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({
      where: { email, is_active: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { unitIds, roles } = await this.buildContext(user.id);

    const accessToken = this.sign(user, roles, unitIds);

    return {
      accessToken,
      user: {
        id: user.id, // bigint-as-string
        email: user.email,
        fullName: user.full_name,
        organizationId: Number(user.organization_id),
        roles,
        unitIds,
      },
    };
  }

  /**
   * Signup rules (current simple version):
   * - Creates user record
   * - Requires organizationId (or else you can add "bootstrap org" later)
   * - If unitId provided -> create unit_memberships row with roleCode (default "NURSE")
   */
  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();

    const exists = await this.userRepo.findOne({ where: { email } });
    if (exists) {
      throw new BadRequestException('Email already exists');
    }

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

      // Unique constraint (unit_id,user_id) exists; so do a find first
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
    }

    const { unitIds, roles } = await this.buildContext(saved.id);
    const accessToken = this.sign(saved, roles, unitIds);

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

  /**
   * JWT-only logout:
   * - If you're not using refresh tokens or a token blacklist, server can't invalidate access tokens.
   * - Keep this endpoint for consistency and future expansion (refresh tokens / session table).
   */
  async logout(_jwtUser: any, _dto: { deviceId?: string }) {
    return { ok: true };
  }
}
