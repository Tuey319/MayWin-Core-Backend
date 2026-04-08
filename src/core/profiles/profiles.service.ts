// src/core/profiles/profiles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '@/database/entities/users/user-profile.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
  ) {}

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
}
