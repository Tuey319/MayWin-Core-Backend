import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { User } from '@/database/entities/users/user.entity';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';

type AvatarFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
};

type AvatarMeta = {
  bucket: string | null;
  key: string | null;
  contentType: string | null;
  updatedAt: Date | null;
  url: string | null;
};

@Injectable()
export class ProfileService {
  private readonly allowedMimeTypes = new Map<string, string>([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ]);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly s3: S3ArtifactsService,
  ) {}

  private ensureBucketConfigured() {
    const bucket = process.env.MAYWIN_ARTIFACTS_BUCKET?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException('Avatar storage is not configured');
    }
    return bucket;
  }

  private getAvatarUrl() {
    return '/api/v1/core/profile/me/avatar';
  }

  private getExt(mimetype: string) {
    const ext = this.allowedMimeTypes.get(mimetype);
    if (!ext) {
      throw new BadRequestException('Unsupported image type. Use JPEG, PNG, or WebP.');
    }
    return ext;
  }

  private validateFile(file: AvatarFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    if (file.size && file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }
    this.getExt(file.mimetype);
  }

  private toAvatarMeta(user: User): AvatarMeta {
    return {
      bucket: user.avatar_bucket ?? null,
      key: user.avatar_key ?? null,
      contentType: user.avatar_content_type ?? null,
      updatedAt: user.avatar_updated_at ?? null,
      url: user.avatar_key ? this.getAvatarUrl() : null,
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId as any, is_active: true } });
    if (!user) throw new NotFoundException('Account not found');

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        organizationId: Number(user.organization_id),
        attributes: user.attributes ?? {},
        avatar: this.toAvatarMeta(user),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    };
  }

  async uploadMyAvatar(userId: string, file: AvatarFile) {
    this.validateFile(file);
    const ext = this.getExt(file.mimetype);
    const bucket = this.ensureBucketConfigured();

    const user = await this.userRepo.findOne({ where: { id: userId as any, is_active: true } });
    if (!user) throw new NotFoundException('Account not found');

    const previous = {
      bucket: user.avatar_bucket,
      key: user.avatar_key,
    };

    const keyParts = [
      'profile-pictures',
      String(user.organization_id),
      String(user.id),
      `${Date.now()}-${randomUUID()}.${ext}`,
    ];

    const uploaded = await this.s3.putBuffer(keyParts, file.buffer, file.mimetype);

    user.avatar_bucket = uploaded.bucket;
    user.avatar_key = uploaded.key;
    user.avatar_content_type = file.mimetype;
    user.avatar_updated_at = new Date();

    try {
      const saved = await this.userRepo.save(user);

      if (
        previous.bucket &&
        previous.key &&
        (previous.bucket !== uploaded.bucket || previous.key !== uploaded.key)
      ) {
        await this.s3.deleteObject({ bucket: previous.bucket, key: previous.key }).catch(() => undefined);
      }

      return {
        ok: true,
        avatar: this.toAvatarMeta(saved),
      };
    } catch (err) {
      await this.s3.deleteObject(uploaded).catch(() => undefined);
      throw err;
    }
  }

  async getMyAvatar(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId as any, is_active: true } });
    if (!user || !user.avatar_bucket || !user.avatar_key) {
      throw new NotFoundException('Avatar not found');
    }

    const res = await this.s3.getObject({
      bucket: user.avatar_bucket,
      key: user.avatar_key,
    });

    if (!res.Body) {
      throw new NotFoundException('Avatar not found');
    }

    return {
      body: res.Body,
      contentType: res.ContentType ?? user.avatar_content_type ?? 'application/octet-stream',
    };
  }

  async deleteMyAvatar(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId as any, is_active: true } });
    if (!user) throw new NotFoundException('Account not found');

    const previous = {
      bucket: user.avatar_bucket,
      key: user.avatar_key,
    };

    user.avatar_bucket = null;
    user.avatar_key = null;
    user.avatar_content_type = null;
    user.avatar_updated_at = null;
    await this.userRepo.save(user);

    if (previous.bucket && previous.key) {
      await this.s3.deleteObject({ bucket: previous.bucket, key: previous.key }).catch(() => undefined);
    }

    return { ok: true };
  }
}
