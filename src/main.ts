// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Base global prefix for all routes
  app.setGlobalPrefix('/api/v1/core');

  // TODO: add validation pipe, CORS, logging, etc.
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
