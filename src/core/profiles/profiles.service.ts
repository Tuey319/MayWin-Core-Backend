// src/core/profiles/profiles.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { UserProfile } from '@/database/entities/users/user-profile.entity';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';

type AvatarUpload = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
};

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    private readonly s3: S3ArtifactsService,
  ) {}

  private ensureBucketConfigured(): string {
    const bucket = process.env.MAYWIN_ARTIFACTS_BUCKET?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException('Avatar storage is not configured');
    }
    return bucket;
  }

  private avatarContentType(profile: UserProfile) {
    return (
      profile.avatar_content_type ??
      profile.metadata?.avatarContentType ??
      profile.metadata?.avatar_content_type ??
      'application/octet-stream'
    );
  }

  private avatarBucket(profile: UserProfile) {
    return profile.avatar_bucket ?? profile.metadata?.avatarBucket ?? this.ensureBucketConfigured();
  }

  private avatarKey(profile: UserProfile): string | null {
    return profile.avatar_key?.trim() || profile.avatar_data?.trim() || null;
  }

  private validateAvatar(file: AvatarUpload) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    if (file.size && file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image type. Use JPEG, PNG, or WebP.');
    }
  }

  private toApi(profile: UserProfile) {
    const key = this.avatarKey(profile);
    return {
      id: profile.id,
      userId: profile.user_id,
      avatar_data: profile.avatar_data,
      avatar_bucket: profile.avatar_bucket,
      avatar_key: profile.avatar_key,
      avatar_content_type: profile.avatar_content_type,
      avatar_updated_at: profile.avatar_updated_at,
      bio: profile.bio,
      phone_number: profile.phone_number,
      metadata: profile.metadata ?? {},
      avatar: key
        ? {
            bucket: this.avatarBucket(profile),
            key,
            contentType: this.avatarContentType(profile),
            url: '/api/v1/core/profiles/me/avatar',
          }
        : null,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    let profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    
    if (!profile) {
      // Create a default empty profile if none exists
      profile = this.profileRepo.create({ user_id: userId });
      await this.profileRepo.save(profile);
    }

    return profile;
  }

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    let profile = await this.profileRepo.findOne({ where: { user_id: userId } });

    if (!profile) {
      profile = this.profileRepo.create({ ...data, user_id: userId });
    } else {
      Object.assign(profile, data);
    }

    return this.profileRepo.save(profile);
  }

  async uploadAvatar(userId: string, file: AvatarUpload) {
    this.validateAvatar(file);

    const profile = await this.getProfile(userId);
    const bucket = this.avatarBucket(profile);
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const keyParts = ['profiles', 'avatars', userId, `${Date.now()}-${randomUUID()}.${ext}`];

    const previousKey = this.avatarKey(profile);
    const previousBucket = profile.avatar_bucket ?? profile.metadata?.avatarBucket ?? bucket;
    const previousMeta = profile.metadata ?? {};

    let uploaded: { bucket: string; key: string } | undefined;
    try {
      uploaded = await this.s3.putBuffer(keyParts, file.buffer, file.mimetype);

      profile.avatar_data = uploaded.key;
      profile.avatar_bucket = uploaded.bucket;
      profile.avatar_key = uploaded.key;
      profile.avatar_content_type = file.mimetype;
      profile.avatar_updated_at = new Date();
      profile.metadata = {
        ...previousMeta,
        avatarOriginalName: file.originalname ?? null,
      };

      const saved = await this.profileRepo.save(profile);

      if (previousKey && previousKey !== uploaded.key) {
        await this.s3.deleteObject({ bucket: previousBucket, key: previousKey }).catch(() => undefined);
      }

      return { profile: this.toApi(saved) };
    } catch (err) {
      const error = err as any;
      this.logger.error(
        `Avatar upload failed for user ${userId}: ${error?.name ?? 'Error'} ${error?.code ?? ''} ${error?.message ?? String(err)}`.trim(),
      );

      if (uploaded) {
        await this.s3.deleteObject(uploaded).catch(() => undefined);
      }
      throw new ServiceUnavailableException('Unable to store avatar right now. Please try again.');
    }
  }

  async getAvatar(userId: string) {
    const profile = await this.getProfile(userId);
    const key = this.avatarKey(profile);
    if (!key) {
      throw new NotFoundException('Avatar not found');
    }

    const bucket = this.avatarBucket(profile);
    const res = await this.s3.getObject({ bucket, key });
    if (!res.Body) {
      throw new NotFoundException('Avatar not found');
    }

    return {
      body: res.Body as Readable,
      contentType: res.ContentType ?? this.avatarContentType(profile),
    };
  }

  async deleteAvatar(userId: string) {
    const profile = await this.getProfile(userId);
    const key = this.avatarKey(profile);
    if (key) {
      const bucket = this.avatarBucket(profile);
      await this.s3.deleteObject({ bucket, key }).catch(() => undefined);
    }

    profile.avatar_data = null;
    profile.avatar_bucket = null;
    profile.avatar_key = null;
    profile.avatar_content_type = null;
    profile.avatar_updated_at = null;
    profile.metadata = {
      ...(profile.metadata ?? {}),
      avatarBucket: null,
      avatarContentType: null,
      avatarOriginalName: null,
      avatarUpdatedAt: null,
    };

    const saved = await this.profileRepo.save(profile);
    return { profile: this.toApi(saved) };
  }
}
