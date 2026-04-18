// src/core/health/health.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { access, constants } from 'fs/promises';
import * as path from 'path';

@Controller()
export class HealthController {
  /** Public ping — load balancers / uptime monitors. */
  @Get('health')
  health() {
    return { status: 'ok', service: 'core-backend', time: new Date().toISOString() };
  }

  /** Public build info. */
  @Get('info')
  info() {
    return {
      buildTime: process.env.BUILD_TIME ?? 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  /** Full system health — JWT-authenticated. */
  @UseGuards(JwtAuthGuard)
  @Get('health/system')
  async systemHealth() {
    const [database, s3, solver] = await Promise.all([
      this.checkDatabase(),
      this.checkS3(),
      this.checkSolver(),
    ]);

    const mem = process.memoryUsage();
    const mb = (n: number) => Math.round(n / 1024 / 1024);

    return {
      checkedAt: new Date().toISOString(),
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV ?? 'development',
        buildTime: process.env.BUILD_TIME ?? 'unknown',
        memory: { heapUsedMb: mb(mem.heapUsed), heapTotalMb: mb(mem.heapTotal), rssMb: mb(mem.rss) },
      },
      checks: {
        database,
        s3,
        solver,
        mail: this.checkMail(),
        line: this.checkLine(),
      },
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────

  private async checkDatabase(): Promise<Record<string, any>> {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const user = process.env.DB_USER;
    const name = process.env.DB_NAME;
    const configured = !!(host && port && user && name);
    return {
      ok: configured,
      configured,
      host: host ?? null,
      port: port ?? null,
      database: name ?? null,
      ...(configured ? {} : { error: 'DB env vars missing' }),
    };
  }

  private async checkS3(): Promise<Record<string, any>> {
    const bucket = process.env.MAYWIN_ARTIFACTS_BUCKET?.trim();
    if (!bucket) {
      return { ok: false, configured: false, error: 'MAYWIN_ARTIFACTS_BUCKET not set — logs lost on cold start' };
    }
    try {
      const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-southeast-1' });
      const start = Date.now();
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return { ok: true, configured: true, bucket, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, configured: true, bucket, error: err?.message ?? String(err) };
    }
  }

  private async checkSolver(): Promise<Record<string, any>> {
    const cliPath = process.env.SOLVER_CLI_PATH?.trim() ?? 'src/core/solver/solver_cli.py';
    const absPath = path.isAbsolute(cliPath) ? cliPath : path.resolve(process.cwd(), cliPath);
    const pythonCmd = process.env.SOLVER_PYTHON?.trim() ?? (process.platform === 'win32' ? 'py' : 'python3');
    try {
      await access(absPath, constants.R_OK);
      return { ok: true, pythonCmd, cliPath: absPath };
    } catch {
      return { ok: false, pythonCmd, cliPath: absPath, error: 'CLI not found at path' };
    }
  }

  private checkMail(): Record<string, any> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const configured = !!(host && user && pass);
    return { ok: configured, configured, host: host ?? null, userSet: !!user };
  }

  private checkLine(): Record<string, any> {
    const hasSecret = !!process.env.LINE_CHANNEL_SECRET;
    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    return { ok: hasSecret && hasToken, channelSecretSet: hasSecret, accessTokenSet: hasToken };
  }
}
