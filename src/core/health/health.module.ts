// src/core/health/health.module.ts
import { Module } from '@nestjs/common';
import { BucketsModule } from '@/database/buckets/buckets.module';
import { HealthController } from './health.controller';

@Module({
  imports: [BucketsModule],
  controllers: [HealthController],
})
export class HealthModule {}
