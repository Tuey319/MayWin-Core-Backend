// src/core/auth/token-blocklist.service.ts
// ISO 27001:2022 A.9.4.2 — session invalidation on logout
// Stores revoked JWT identities in Redis. Falls back to a no-op (pass-through)
// when REDIS_URL is unset so local dev without Redis still works.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class TokenBlocklistService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenBlocklistService.name);
  private readonly redis: Redis | null;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableReadyCheck: false,
      });
      this.redis.on('error', (err) =>
        this.logger.warn(`[BLOCKLIST] Redis error: ${err.message}`),
      );
    } else {
      this.redis = null;
      this.logger.warn(
        '[BLOCKLIST] REDIS_URL not set — token blocklist is disabled. ' +
        'Logout will not invalidate tokens. Set REDIS_URL in production.',
      );
    }
  }

  /** Block a token identified by (sub, iat) for the remainder of its lifetime. */
  async block(sub: number, iat: number, exp: number): Promise<void> {
    if (!this.redis) return;
    const ttlSeconds = exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) return; // already expired
    const key = this.redisKey(sub, iat);
    try {
      await this.redis.set(key, '1', 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`[BLOCKLIST] Failed to write block entry: ${err.message}`);
    }
  }

  /** Returns true if this token has been revoked. */
  async isBlocked(sub: number, iat: number): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const val = await this.redis.get(this.redisKey(sub, iat));
      return val === '1';
    } catch {
      // Redis unavailable — fail open (don't block valid traffic)
      return false;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => {});
  }

  private redisKey(sub: number, iat: number): string {
    return `blocklist:${sub}:${iat}`;
  }
}
