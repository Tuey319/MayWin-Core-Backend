// src/core/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt-strategy';
import { MailModule } from '@/core/mail/mail.module';

import { User } from '@/database/entities/users/user.entity';
import { UnitMembership } from '@/database/entities/users/unit-membership.entity';
import { UserRole } from '@/database/entities/users/user-role.entity';
import { Role } from '@/database/entities/core/role.entity';
import { AuthOtp } from '@/database/entities/users/auth-otp.entity';
import { Worker } from '@/database/entities/workers/worker.entity';

@Module({
  imports: [
    ConfigModule,
    MailModule,

    TypeOrmModule.forFeature([User, UnitMembership, UserRole, Role, AuthOtp, Worker]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule { }
