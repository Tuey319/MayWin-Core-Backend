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
}
