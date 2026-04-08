import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { 
    rawBody: true,
    bodyParser: false 
  });

  // CRITICAL: Set limits BEFORE any other middleware or prefix
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Layer 3 Diagnostic: Log ALL incoming request sizes
  app.use((req: any, res: any, next: any) => {
    const size = req.headers['content-length'];
    if (size && parseInt(size) > 1024 * 1024) { // Only log if > 1MB
       console.log(`[Backend DEBUG] ${req.method} ${req.url} | Size: ${size} bytes (${(parseInt(size) / 1024 / 1024).toFixed(2)} MB)`);
    }
    next();
  });

  app.setGlobalPrefix('api/v1/core');

  // Hardcode port to 3005 to match BFF's BACKEND_URL_LOCAL
  const port = 3005;
  await app.listen(port, '0.0.0.0');
  console.log(`Core Backend successfully running on http://localhost:${port}/api/v1/core`);
}
bootstrap();
