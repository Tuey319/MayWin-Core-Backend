import 'reflect-metadata';
import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as serverlessExpress from '@vendia/serverless-express';

let cachedServer: any;

async function bootstrapServer() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.setGlobalPrefix('api/v1/core');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: '*', methods: '*', allowedHeaders: '*' });

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();

  return serverlessExpress.configure({ app: expressApp });
}

export const handler = async (event: any, context: any) => {
  if (!cachedServer) cachedServer = await bootstrapServer();
  return cachedServer(event, context);
};
