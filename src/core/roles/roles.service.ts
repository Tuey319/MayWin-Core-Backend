// src/core/roles/roles.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@/database/entities/core/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async list() {
    const rows = await this.roleRepo.find({ order: { created_at: 'ASC' as any } });

    return {
      items: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        createdAt: r.created_at,
      })),
    };
  }
}
