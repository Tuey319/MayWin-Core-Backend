// src/core/profiles/profiles.controller.ts
import {
  BadRequestException,
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
import { UpdateProfileDto } from './dto/update-profile.dto';

const { FileInterceptor } = require('@nestjs/platform-express');
const { memoryStorage } = require('multer');

// ISO 27001:2022 A.8.26 — only JPEG/PNG/WebP accepted for avatar uploads
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  async getMyProfile(@Req() req: Request) {
    const user = (req as any).user;
    return this.profilesService.getProfile(String(user.sub));
  }

  // ISO 27001:2022 A.8.26 — DTO replaces @Body() data: any; ValidationPipe enforces field constraints
  @Patch('me')
  async updateMyProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const user = (req as any).user;
    return this.profilesService.updateProfile(String(user.sub), {
      bio: dto.bio,
      phone_number: dto.phone_number,
    });
  }

  // ISO 27001:2022 A.8.26 — fileFilter restricts upload to safe image MIME types only
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
        }
      },
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
