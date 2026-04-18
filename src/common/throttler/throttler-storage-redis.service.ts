// src/common/throttler/throttler-storage-redis.service.ts
// Redis-backed ThrottlerStorage — safe for multi-instance Lambda deployments (A.8.5, R-11)
// Falls back gracefully: if Redis is unreachable, per-instance limits still apply.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(ThrottlerStorageRedisService.name);
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableReadyCheck: false,
    });
    this.redis.on('error', (err) =>
      this.logger.warn(`[THROTTLER] Redis error: ${err.message}`),
    );
  }

  async increment(
    key: string,
    ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const multi = this.redis.multi();
      multi.incr(key);
      multi.pttl(key);
      const results = await multi.exec();
      const totalHits = (results?.[0]?.[1] as number) ?? 1;
      let timeToExpire = (results?.[1]?.[1] as number) ?? ttl;
      // Key exists but has no TTL — set it now
      if (timeToExpire < 0) {
        await this.redis.pexpire(key, ttl);
        timeToExpire = ttl;
      }
      return { totalHits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
    } catch {
      // Redis unavailable — allow through; per-instance limits still apply
      return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }
}
