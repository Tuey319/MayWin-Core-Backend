// src/database/buckets/buckets.module.ts
import { Module } from '@nestjs/common';
import { S3ArtifactsService } from './s3-artifacts.service';

@Module({
  providers: [S3ArtifactsService],
  exports: [S3ArtifactsService],
})
export class BucketsModule {}
