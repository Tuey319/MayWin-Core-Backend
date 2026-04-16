// src/common/middleware/request-logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Logs every inbound HTTP request and its response status/duration.
 * Never logs passwords, tokens, or OTP values.
 * ISO 27001:2022 — 8.15 (Logging), 8.16 (Monitoring activities)
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const userAgent = req.headers['user-agent'] ?? '';
    const ip = req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown';
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const user = (req as any).user;
      const userId = user?.sub ?? user?.id ?? 'anon';

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms | user=${userId} ip=${ip} ua="${userAgent}"`,
      );
    });

    next();
  }
}
