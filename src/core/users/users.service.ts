import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '@/database/entities/users/user.entity';
import { UserRole } from '@/database/entities/users/user-role.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { Role } from '@/database/entities/core/role.entity';
import { PatchUserDto } from './dto/patch-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignMembershipDto } from './dto/assign-membership.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(UnitMembership) private readonly membershipRepo: Repository<UnitMembership>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  async list(filters: { pending?: boolean; noOrg?: boolean; organizationId?: string }) {
    const qb = this.userRepo.createQueryBuilder('u');

    if (filters.organizationId) {
      qb.andWhere('u.organization_id = :orgId', { orgId: filters.organizationId });
    }

    if (filters.noOrg) {
      qb.andWhere('u.organization_id IS NULL');
    }

    if (filters.pending) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM maywin_db.user_roles ur WHERE ur.user_id = u.id
        )`,
      );
    }

    const users = await qb.orderBy('u.created_at', 'DESC').getMany();

    const userIds = users.map((u) => u.id);
    const [allRoles, allMemberships] = userIds.length
      ? await Promise.all([
          this.userRoleRepo.createQueryBuilder('ur')
            .innerJoin(Role, 'r', 'r.id = ur.role_id')
            .select(['ur.user_id as user_id', 'r.id as role_id', 'r.code as role_code', 'r.name as role_name'])
            .where('ur.user_id IN (:...ids)', { ids: userIds })
            .getRawMany(),
          this.membershipRepo.find({ where: userIds.map((id) => ({ user_id: id })) as any }),
        ])
      : [[], []];

    return {
      users: users.map((u) => this.toApi(u, allRoles, allMemberships)),
    };
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } as any });
    if (!user) throw new NotFoundException('User not found');

    const [roles, memberships] = await Promise.all([
      this.userRoleRepo.createQueryBuilder('ur')
        .innerJoin(Role, 'r', 'r.id = ur.role_id')
        .select(['ur.user_id as user_id', 'r.id as role_id', 'r.code as role_code', 'r.name as role_name'])
        .where('ur.user_id = :id', { id })
        .getRawMany(),
      this.membershipRepo.find({ where: { user_id: id } as any }),
    ]);

    return { user: this.toApi(user, roles, memberships) };
  }

  async patch(id: string, dto: PatchUserDto) {
    const user = await this.userRepo.findOne({ where: { id } as any });
    if (!user) throw new NotFoundException('User not found');

    if (dto.fullName !== undefined) user.full_name = dto.fullName;
    if (dto.organizationId !== undefined) user.organization_id = dto.organizationId;
    if (dto.isActive !== undefined) user.is_active = dto.isActive;

    await this.userRepo.save(user);
    return this.findOne(id);
  }

  async assignRole(userId: string, dto: AssignRoleDto) {
    await this.userRepo.findOneOrFail({ where: { id: userId } as any }).catch(() => {
      throw new NotFoundException('User not found');
    });

    let role: Role | null = null;
    if (dto.roleId) {
      role = await this.roleRepo.findOne({ where: { id: dto.roleId } as any });
    } else if (dto.roleCode) {
      role = await this.roleRepo.findOne({ where: { code: dto.roleCode } as any });
    }
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.userRoleRepo.findOne({
      where: { user_id: userId, role_id: role.id } as any,
    });
    if (!existing) {
      await this.userRoleRepo.save(
        this.userRoleRepo.create({ user_id: userId, role_id: role.id }),
      );
    }

    return this.findOne(userId);
  }

  async removeRole(userId: string, roleId: string) {
    const row = await this.userRoleRepo.findOne({
      where: { user_id: userId, role_id: roleId } as any,
    });
    if (!row) throw new NotFoundException('Role assignment not found');
    await this.userRoleRepo.remove(row);
    return this.findOne(userId);
  }

  async assignMembership(userId: string, dto: AssignMembershipDto) {
    await this.userRepo.findOneOrFail({ where: { id: userId } as any }).catch(() => {
      throw new NotFoundException('User not found');
    });

    const existing = await this.membershipRepo.findOne({
      where: { user_id: userId, unit_id: dto.unitId } as any,
    });
    if (existing) {
      existing.role_code = (dto.roleCode ?? existing.role_code).trim();
      await this.membershipRepo.save(existing);
    } else {
      await this.membershipRepo.save(
        this.membershipRepo.create({
          user_id: userId,
          unit_id: dto.unitId,
          role_code: (dto.roleCode ?? 'NURSE').trim(),
        }),
      );
    }

    return this.findOne(userId);
  }

  async removeMembership(userId: string, unitId: string) {
    const row = await this.membershipRepo.findOne({
      where: { user_id: userId, unit_id: unitId } as any,
    });
    if (!row) throw new NotFoundException('Membership not found');
    await this.membershipRepo.remove(row);
    return this.findOne(userId);
  }

  private toApi(
    u: User,
    allRoles: Array<{ user_id: string; role_id: string; role_code: string; role_name: string }>,
    allMemberships: UnitMembership[],
  ) {
    const roles = allRoles
      .filter((r) => r.user_id === u.id)
      .map((r) => ({ roleId: r.role_id, roleCode: r.role_code, roleName: r.role_name }));

    const memberships = allMemberships
      .filter((m) => m.user_id === u.id)
      .map((m) => ({ unitId: m.unit_id, roleCode: m.role_code }));

    return {
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      organizationId: u.organization_id,
      isActive: u.is_active,
      roles,
      memberships,
      createdAt: u.created_at,
    };
  }
}
