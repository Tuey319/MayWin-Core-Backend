// src/core/roles/roles.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesService } from './roles.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class RolesController {
  constructor(private readonly svc: RolesService) {}

  // GET /roles
  @Get('/roles')
  list() {
    return this.svc.list();
  }
}
