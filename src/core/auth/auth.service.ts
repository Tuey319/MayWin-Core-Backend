// src/core/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { UserRole } from '@/database/entities/users/user-role.entity';
import { JwtPayload } from './types/jwt-payload';

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

    // Unit context (roles + unitIds)
    const memberships = await this.unitMembershipRepo.find({
      where: { user_id: user.id },
    });

    const unitIds = memberships.map((m) => Number(m.unit_id));
    const roles = [...new Set(memberships.map((m) => m.role_code))];

    // (Optional) user_roles table is not required for auth right now.
    // Keeping repo injected because you already have the entity.
    // const userRoles = await this.userRoleRepo.find({ where: { user_id: user.id } });

    const payload: JwtPayload = {
      sub: Number(user.id),
      organizationId: Number(user.organization_id),
      roles,
      unitIds,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id, // keep as string in response if your DB uses bigint-as-string
        organizationId: Number(user.organization_id),
        roles,
        unitIds,
      },
    };
  }
}
