// src/core/auth/auth.controller.ts
import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { LogoutDto } from './dto/logout.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PatchUsernameDto } from './dto/patch-username.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Public } from '@/common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * POST /auth/login
   * Returns { requires2FA: true, otpToken } — NOT a usable JWT.
   * The client must call /auth/verify-otp with the OTP from email.
   */
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * POST /auth/verify-otp
   * Validates the OTP sent to email + the pending token from /auth/login.
   * Returns { accessToken, user } on success.
   */
  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.otpToken, dto.otp);
  }

  @Public()
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
