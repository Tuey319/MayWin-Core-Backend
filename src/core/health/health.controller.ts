// src/core/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  // GET /core/health
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'core-backend',
      version: '1.0.0',
      time: new Date().toISOString(),
    };
  }

  // GET /core/info
  @Get('info')
  info() {
    return {
      buildTime: '2026-04-07T12:51:00Z', // Injected at build/edit time
      appStartTime: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      dbSource: process.env.DB_SOURCE || 'restored',
    };
  }
}
