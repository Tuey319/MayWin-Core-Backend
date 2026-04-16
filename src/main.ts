import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validateEnvironment } from './config/env-validation';

async function bootstrap() {
  // Fail fast if critical env vars are missing (ISO 27001:2022 — 8.9, 5.36)
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  // Security headers — CSP, X-Frame-Options, HSTS, etc. (8.20, 8.21)
  app.use(helmet());

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

  // CORS — restrict to configured origins (8.20)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : false;
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Hardcode port to 3005 to match BFF's BACKEND_URL_LOCAL
  const port = process.env.PORT ?? 3005;
  await app.listen(port, '0.0.0.0');
  console.log(`Core Backend running on http://localhost:${port}/api/v1/core`);
}
bootstrap();
