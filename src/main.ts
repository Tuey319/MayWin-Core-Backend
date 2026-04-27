import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validateEnvironment } from './config/env-validation';
import { loadSecretsFromAWS } from './config/secrets-manager';

async function bootstrap() {
  // Pull secrets from AWS Secrets Manager before anything else (ISO 27001:2022 — 8.9)
  await loadSecretsFromAWS();

  // Fail fast if critical env vars are missing (ISO 27001:2022 — 8.9, 5.36)
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  // Security headers — explicit CSP, X-Frame-Options, HSTS, etc. (8.20, 8.21)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );

  // Body size limits — prevent large-payload DoS (8.20)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Base global prefix for all routes
  app.setGlobalPrefix('api/v1/core');

  // Input validation — strip unknown fields, transform types (8.26, 8.28)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Consistent error responses — no stack trace leakage (8.12)
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS — restrict to configured origins and methods (8.20)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : false;
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Bind to loopback by default; 0.0.0.0 only if BIND_HOST is explicitly set
  const port = process.env.PORT ?? 3005;
  const host = process.env.BIND_HOST ?? '127.0.0.1';
  await app.listen(port, host);
  console.log(`Core Backend running on http://localhost:${port}/api/v1/core`);
}
bootstrap();
