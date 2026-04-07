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
  // Using the standard NestJS / Express approach
  const express = require('express');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Layer 3 Diagnostic: Log incoming body size
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'PATCH' && req.url.includes('profiles/me')) {
      console.log(`[Backend] Incoming PATCH /profiles/me | Content-Length: ${req.headers['content-length']} bytes`);
    }
    next();
  });

  // TODO: add validation pipe, CORS, logging, etc.
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
