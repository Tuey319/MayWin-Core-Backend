// src/core/profiles/profiles.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

const { FileInterceptor } = require('@nestjs/platform-express');
const { memoryStorage } = require('multer');

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
    const { bio, phone_number } = data;
    return this.profilesService.updateProfile(String(user.sub), {
      bio,
      phone_number,
    });
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadMyAvatar(@Req() req: Request, @UploadedFile() file: any) {
    const user = (req as any).user;
    return this.profilesService.uploadAvatar(String(user.sub), file);
  }

  @Get('me/avatar')
  async getMyAvatar(@Req() req: Request, @Res({ passthrough: true }) res: any) {
    const user = (req as any).user;
    const avatar = await this.profilesService.getAvatar(String(user.sub));
    res.setHeader('Content-Type', avatar.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(avatar.body as any);
  }

  @Delete('me/avatar')
  async deleteMyAvatar(@Req() req: Request) {
    const user = (req as any).user;
    return this.profilesService.deleteAvatar(String(user.sub));
  }
}
