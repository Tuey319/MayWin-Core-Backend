// src/core/auth/auth.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/login
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // POST /auth/signup
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
}
