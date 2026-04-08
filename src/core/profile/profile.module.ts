import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BucketsModule } from '@/database/buckets/buckets.module';
import { User } from '@/database/entities/users/user.entity';
import { UserProfile } from '@/database/entities/users/user-profile.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile]),
    BucketsModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
