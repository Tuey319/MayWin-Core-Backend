// src/config/env-validation.ts
import { Logger } from '@nestjs/common';

/**
 * Validates required environment variables on startup.
 * Fails hard if critical secrets are missing.
 * ISO 27001:2022 — 5.36 (Compliance), 8.9 (Configuration management)
 */
export function validateEnvironment(): void {
  const logger = new Logger('EnvValidation');

  const isProd = process.env.NODE_ENV === 'production';

  const required: string[] = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
  ];

  if (isProd) {
    required.push('REDIS_URL');
  }

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  // Warn about optional-but-recommended vars
  const recommended = [
    'LINE_CHANNEL_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'ALLOWED_ORIGINS',
    'NODE_ENV',
  ];

  const missingRecommended = recommended.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    logger.warn(
      `Missing recommended environment variables: ${missingRecommended.join(', ')}`,
    );
  }

  if (process.env.MAYWIN_SFN_ARN) {
    logger.warn('MAYWIN_SFN_ARN is deprecated — rename it to SCHEDULE_WORKFLOW_ARN');
  }

  logger.log('Environment validation passed');
}
