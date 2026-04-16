// src/core/auth/auth.controller.ts
import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { LogoutDto } from './dto/logout.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PatchUsernameDto } from './dto/patch-username.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * POST /auth/login
   * 10 attempts per 15 minutes per IP — brute force protection (ISO 27001:2022 — 8.5)
   */
  @Throttle({ default: { ttl: 900000, limit: 10 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * POST /auth/verify-otp
   * 10 attempts per 15 minutes per IP (ISO 27001:2022 — 8.5)
   */
  @Throttle({ default: { ttl: 900000, limit: 10 } })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.otpToken, dto.otp);
  }

  /**
   * POST /auth/signup
   * 5 signups per hour per IP (ISO 27001:2022 — 8.5)
   */
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Body() dto: LogoutDto) {
    const user = (req as any).user;
    return this.authService.logout(user, dto);
  }

  // GET /auth/me
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    return { user: (req as any).user };
  }

  // PATCH /auth/me/username
  @UseGuards(JwtAuthGuard)
  @Patch('me/username')
  async patchUsername(@Req() req: Request, @Body() dto: PatchUsernameDto) {
    const user = (req as any).user;
    return this.authService.patchUsername(String(user.sub), dto.fullName);
  }
}
