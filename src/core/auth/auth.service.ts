// src/core/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { UserRole } from '@/database/entities/users/user-role.entity';
import { Role } from '@/database/entities/users/role.entity';
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

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    private readonly jwtService: JwtService,
  ) {}

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

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const { unitIds, roles } = await this.buildContext(user.id);
    const accessToken = this.sign(user, roles, unitIds);

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

  async logout(_jwtUser: any, _dto: { deviceId?: string }) {
    return { ok: true };
  }
}
