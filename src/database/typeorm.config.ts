// src/database/typeorm.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import { join } from 'path';

export function typeOrmConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'maywin12345',
    database: process.env.DB_NAME || 'maywin',
    schema: process.env.DB_SCHEMA || 'maywin_db',

    synchronize: false,
    migrationsRun: false,
    logging: true,

    autoLoadEntities: true,

    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  };
}

export function dataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'maywin12345',
    database: process.env.DB_NAME || 'maywin',
    schema: process.env.DB_SCHEMA || 'maywin_db',

    synchronize: false,
    logging: true,

    entities: [join(__dirname, 'entities/*.entity{.ts,.js}')],

    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  };
}
