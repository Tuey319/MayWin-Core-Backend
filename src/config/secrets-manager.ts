// src/config/secrets-manager.ts
import { Logger } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const logger = new Logger('SecretsManager');

// Names of JSON keys in the maywin/production secret that map 1-to-1 to env vars.
// Any key present in the secret blob that is NOT listed here is ignored.
const SECRET_NAME = process.env.AWS_SECRET_NAME ?? 'maywin/production';
const SECRET_REGION = process.env.AWS_REGION ?? 'ap-southeast-1';

const ALLOWED_SECRET_KEYS = new Set([
  'DB_HOST',
  'DB_HOST_RESTORED',
  'DB_HOST_OLD',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_SCHEMA',
  'JWT_SECRET',
  'REDIS_URL',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'GEMINI_API_KEY',
  'GEMINI_API_KEY_2',
  'GEMINI_API_KEY_3',
  'GEMINI_API_KEY_4',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
]);

/**
 * Fetches the maywin/production secret from AWS Secrets Manager and injects
 * all recognised keys into process.env so the rest of bootstrap() sees them.
 *
 * - In production: throws (and halts startup) if the secret cannot be reached.
 * - Outside production: logs a warning and continues so local dev is unaffected.
 */
export async function loadSecretsFromAWS(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';

  const client = new SecretsManagerClient({ region: SECRET_REGION });

  let secretString: string;
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: SECRET_NAME }),
    );

    if (!response.SecretString) {
      throw new Error('SecretString is empty — binary secrets are not supported');
    }
    secretString = response.SecretString;
  } catch (err) {
    const msg = `Failed to fetch secret "${SECRET_NAME}" from AWS Secrets Manager (region: ${SECRET_REGION}): ${(err as Error).message}`;
    if (isProd) {
      // Hard fail — do not start with missing secrets in production
      logger.error(msg);
      throw new Error(msg);
    }
    logger.warn(`${msg} — continuing without AWS secrets (non-production)`);
    return;
  }

  let blob: Record<string, unknown>;
  try {
    blob = JSON.parse(secretString) as Record<string, unknown>;
  } catch {
    const msg = `Secret "${SECRET_NAME}" is not valid JSON`;
    if (isProd) {
      logger.error(msg);
      throw new Error(msg);
    }
    logger.warn(`${msg} — continuing without AWS secrets (non-production)`);
    return;
  }

  let injected = 0;
  for (const [key, value] of Object.entries(blob)) {
    if (!ALLOWED_SECRET_KEYS.has(key)) continue;
    if (typeof value !== 'string') continue;
    // Only inject if not already set — allows local overrides via .env files
    if (!process.env[key]) {
      process.env[key] = value;
      injected++;
    }
  }

  logger.log(
    `Loaded ${injected} secret(s) from AWS Secrets Manager ("${SECRET_NAME}")`,
  );
}
