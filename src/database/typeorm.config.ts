// src/database/typeorm.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import { join } from 'path';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not defined`);
  }
  return value;
}

export function typeOrmConfig(): TypeOrmModuleOptions {
  const source = process.env.DB_SOURCE || 'restored';
  let host = process.env.DB_HOST;

  if (source === 'restored') {
    host = process.env.DB_HOST_RESTORED || host;
  } else if (source === 'old') {
    host = process.env.DB_HOST_OLD || host;
  }

  // ISO 27001:2022 A.8.20 — enforce certificate validation in production
  const isProd = process.env.NODE_ENV === 'production';
  const sslConfig = { rejectUnauthorized: isProd };

  return {
    type: 'postgres',
    host: host ?? requireEnv('DB_HOST'),
    port: Number(requireEnv('DB_PORT')),
    username: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    schema: requireEnv('DB_SCHEMA'),
    ssl: sslConfig,
    extra: {
      ssl: sslConfig,
      connectionTimeoutMillis: 5000,
    },

    synchronize: false,
    migrationsRun: false,
    logging: true,
    autoLoadEntities: true,
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],

    retryAttempts: 0,
    retryDelay: 0,
  };
}

export function dataSourceOptions(): DataSourceOptions {
  const source = process.env.DB_SOURCE || 'restored';
  let host = process.env.DB_HOST;

  if (source === 'restored') {
    host = process.env.DB_HOST_RESTORED || host;
  } else if (source === 'old') {
    host = process.env.DB_HOST_OLD || host;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const sslConfig = { rejectUnauthorized: isProd };

  return {
    type: 'postgres',

    host: host ?? requireEnv('DB_HOST'),
    port: Number(requireEnv('DB_PORT')),
    username: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    schema: requireEnv('DB_SCHEMA'),
    ssl: sslConfig,
    extra: {
      ssl: sslConfig,
    },

    synchronize: false,
    logging: true,

    entities: [join(__dirname, 'entities/**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  };
}
