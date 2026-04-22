import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { PatchUserDto } from './dto/patch-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignMembershipDto } from './dto/assign-membership.dto';

@Roles('SCHEDULER')
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('/users')
  list(
    @Query('pending') pending?: string,
    @Query('noOrg') noOrg?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.svc.list({
      pending: pending === 'true',
      noOrg: noOrg === 'true',
      organizationId,
    });
  }

  @Get('/users/:id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch('/users/:id')
  patch(@Param('id') id: string, @Body() dto: PatchUserDto) {
    return this.svc.patch(id, dto);
  }

  @Post('/users/:id/roles')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.svc.assignRole(id, dto);
  }

  @Delete('/users/:id/roles/:roleId')
  removeRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.svc.removeRole(id, roleId);
  }

  @Post('/users/:id/memberships')
  assignMembership(@Param('id') id: string, @Body() dto: AssignMembershipDto) {
    return this.svc.assignMembership(id, dto);
  }

  @Delete('/users/:id/memberships/:unitId')
  removeMembership(@Param('id') id: string, @Param('unitId') unitId: string) {
    return this.svc.removeMembership(id, unitId);
  }
}
