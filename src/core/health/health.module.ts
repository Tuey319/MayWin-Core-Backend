// src/core/health/health.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BucketsModule } from '@/database/buckets/buckets.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([]), // gives access to the shared DataSource
    BucketsModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
