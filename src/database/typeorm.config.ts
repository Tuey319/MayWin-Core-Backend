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

  return {
    type: 'postgres',
    host: host ?? requireEnv('DB_HOST'),
    port: Number(requireEnv('DB_PORT')),
    username: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    schema: requireEnv('DB_SCHEMA'),
    ssl: { rejectUnauthorized: false },
    extra: {
      ssl: { rejectUnauthorized: false },
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

  return {
    type: 'postgres',

    host: host ?? requireEnv('DB_HOST'),
    port: Number(requireEnv('DB_PORT')),
    username: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    schema: requireEnv('DB_SCHEMA'),
    ssl: {
      rejectUnauthorized: false,
    },
    extra: {
      ssl: {
        rejectUnauthorized: false,
      },
    },

    synchronize: false,
    logging: true,

    entities: [join(__dirname, 'entities/**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  };
}
