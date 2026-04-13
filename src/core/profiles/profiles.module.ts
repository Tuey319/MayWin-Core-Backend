// src/core/profiles/profiles.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BucketsModule } from '@/database/buckets/buckets.module';
import { UserProfile } from '@/database/entities/users/user-profile.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserProfile]), BucketsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
