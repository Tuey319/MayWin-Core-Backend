// src/core/profiles/profiles.controller.ts
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  async getMyProfile(@Req() req: Request) {
    const user = (req as any).user;
    return this.profilesService.getProfile(String(user.sub));
  }

  @Patch('me')
  async updateMyProfile(@Req() req: Request, @Body() data: any) {
    const user = (req as any).user;
    // Basic sanitization: only allow specific fields
    const { avatar_data, bio, phone_number } = data;
    return this.profilesService.updateProfile(String(user.sub), {
      avatar_data,
      bio,
      phone_number,
    });
  }
}
