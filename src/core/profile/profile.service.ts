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
import { UserProfile } from '@/database/entities/users/user-profile.entity';
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
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
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

  private toAvatarMeta(profile: UserProfile): AvatarMeta {
    return {
      bucket: profile.avatar_bucket ?? null,
      key: profile.avatar_key ?? profile.avatar_data ?? null,
      contentType: profile.avatar_content_type ?? null,
      updatedAt: profile.avatar_updated_at ?? null,
      url: (profile.avatar_key ?? profile.avatar_data) ? this.getAvatarUrl() : null,
    };
  }

  async getMe(userId: string) {
    let profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    if (!profile) {
      profile = this.profileRepo.create({ user_id: userId });
      await this.profileRepo.save(profile);
    }

    const user = await this.userRepo.findOne({ where: { id: userId as any, is_active: true } });
    if (!user) throw new NotFoundException('Account not found');

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        organizationId: Number(user.organization_id),
        attributes: user.attributes ?? {},
        avatar: this.toAvatarMeta(profile),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    };
  }

  async uploadMyAvatar(userId: string, file: AvatarFile) {
    this.validateFile(file);
    const ext = this.getExt(file.mimetype);
    const bucket = this.ensureBucketConfigured();

    let profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    if (!profile) {
      profile = this.profileRepo.create({ user_id: userId });
      await this.profileRepo.save(profile);
    }

    const user = await this.userRepo.findOne({ where: { id: userId as any, is_active: true } });
    if (!user) throw new NotFoundException('Account not found');

    const previous = {
      bucket: profile.avatar_bucket,
      key: profile.avatar_key ?? profile.avatar_data,
    };

    const keyParts = [
      'profile-pictures',
      String(user.organization_id),
      String(user.id),
      `${Date.now()}-${randomUUID()}.${ext}`,
    ];

    const uploaded = await this.s3.putBuffer(keyParts, file.buffer, file.mimetype);

    profile.avatar_bucket = uploaded.bucket;
    profile.avatar_key = uploaded.key;
    profile.avatar_data = uploaded.key;
    profile.avatar_content_type = file.mimetype;
    profile.avatar_updated_at = new Date();

    try {
      const saved = await this.profileRepo.save(profile);

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
    const profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    const key = profile?.avatar_key ?? profile?.avatar_data ?? null;
    if (!profile || !profile.avatar_bucket || !key) {
      throw new NotFoundException('Avatar not found');
    }

    const res = await this.s3.getObject({
      bucket: profile.avatar_bucket,
      key,
    });

    if (!res.Body) {
      throw new NotFoundException('Avatar not found');
    }

    return {
      body: res.Body,
      contentType: res.ContentType ?? profile.avatar_content_type ?? 'application/octet-stream',
    };
  }

  async deleteMyAvatar(userId: string) {
    const profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Account not found');

    const previous = {
      bucket: profile.avatar_bucket,
      key: profile.avatar_key ?? profile.avatar_data,
    };

    profile.avatar_bucket = null;
    profile.avatar_key = null;
    profile.avatar_data = null;
    profile.avatar_content_type = null;
    profile.avatar_updated_at = null;
    await this.profileRepo.save(profile);

    if (previous.bucket && previous.key) {
      await this.s3.deleteObject({ bucket: previous.bucket, key: previous.key }).catch(() => undefined);
    }

    return { ok: true };
  }
}
