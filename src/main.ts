// src/main.ts
import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { 
    rawBody: true,
    bodyParser: false // Disable default to override with limits below
  });

  // Base global prefix for all routes
  app.setGlobalPrefix('api/v1/core');

  // Increase payload limit for large profile pictures (Base64)
  const { json, urlencoded } = require('express');
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // TODO: add validation pipe, CORS, logging, etc.
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
