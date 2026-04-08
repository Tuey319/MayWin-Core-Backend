import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

const { memoryStorage } = require('multer');

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  private userId(req: Request) {
    const user = (req as any).user ?? {};
    return String(user.sub ?? user.id ?? '');
  }

  @Get('/profile/me')
  getMe(@Req() req: Request) {
    return this.profile.getMe(this.userId(req));
  }

  @Post('/profile/me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadAvatar(@Req() req: Request, @UploadedFile() file: any) {
    return this.profile.uploadMyAvatar(this.userId(req), file);
  }

  @Get('/profile/me/avatar')
  async getAvatar(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const avatar = await this.profile.getMyAvatar(this.userId(req));
    res.setHeader('Content-Type', avatar.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(avatar.body as any);
  }

  @Delete('/profile/me/avatar')
  removeAvatar(@Req() req: Request) {
    return this.profile.deleteMyAvatar(this.userId(req));
  }
}
