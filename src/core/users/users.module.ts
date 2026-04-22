import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/database/entities/users/user.entity';
import { UserRole } from '@/database/entities/users/user-role.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { Role } from '@/database/entities/core/role.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, UnitMembership, Role])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
