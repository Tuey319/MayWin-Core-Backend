import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AuditLogsService } from '@/core/audit-logs/audit-logs.service';

/**
 * Decodes a JWT payload without verifying the signature.
 * Used only for logging context — the guard already verified the token.
 */
function decodeJwtClaims(authHeader: string | undefined): {
  uid: string; org: string; email: string;
} {
  const fallback = { uid: '-', org: '-', email: '-' };
  try {
    if (!authHeader?.startsWith('Bearer ')) return fallback;
    const b64 = authHeader.slice(7).split('.')[1];
    if (!b64) return fallback;
    const p = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return {
      uid: String(p.sub ?? '-'),
      org: String(p.organizationId ?? '-'),
      email: String(p.email ?? '-'),
    };
  } catch {
    return fallback;
  }
}

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private readonly auditLogs: AuditLogsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;

    // Real client IP — Lambda URL puts it in x-forwarded-for
    const fwd = req.headers['x-forwarded-for'];
    const ip = (typeof fwd === 'string' ? fwd.split(',')[0] : fwd?.[0])?.trim()
      ?? req.socket?.remoteAddress
      ?? 'unknown';

    const ua = (req.headers['user-agent'] ?? '-').slice(0, 200);

    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const { uid, org, email } = decodeJwtClaims(req.headers['authorization'] as string | undefined);

      // ── Structured JSON access log (CloudWatch Logs Insights / SIEM) ──────
      // Fields follow OWASP Logging Vocabulary + RFC 5424 severity
      const entry = {
        ts: new Date().toISOString(),
        type: 'http_access',
        method,
        path: originalUrl,
        status: statusCode,
        ms,
        ip,
        ua,
        uid,
        org,
        email,
        outcome: statusCode < 400 ? 'success' : 'failure',
      };
      // Use process.stdout so Lambda captures it as a plain JSON line (no NestJS prefix)
      process.stdout.write(JSON.stringify(entry) + '\n');

      // ── Security audit log (ISO 27001 A.12.4 / SOC 2 CC6.1) ─────────────
      // Write to persistent audit log for auth failures and server errors.
      // 401 = unauthenticated access attempt  → warning (4)
      // 403 = authorisation failure           → warning (4)
      // 5xx = server/application error        → error (3)
      if (statusCode === 401 || statusCode === 403 || statusCode >= 500) {
        const level = statusCode >= 500 ? 3 : 4;
        const action = statusCode === 401 ? 'HTTP_UNAUTHORIZED'
          : statusCode === 403 ? 'HTTP_FORBIDDEN'
          : 'HTTP_SERVER_ERROR';

        this.auditLogs.append({
          orgId: org !== '-' ? org : 'system',
          actorId: uid,
          actorName: email,
          action,
          targetType: 'endpoint',
          targetId: `${method} ${originalUrl}`,
          detail: `${statusCode} from ip=${ip} ua="${ua.slice(0, 80)}"`,
          level,
        }).catch(() => { /* non-blocking — never let logging crash a request */ });
      }
    });

    next();
  }
}
