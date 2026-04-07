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
      deployedAt: process.env.DEPLOYED_AT || 'Not specified (Development)',
      serverTime: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
