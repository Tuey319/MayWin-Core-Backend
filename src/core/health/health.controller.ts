// src/core/health/health.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { S3ArtifactsService } from '@/database/buckets/s3-artifacts.service';
import { access, constants } from 'fs/promises';
import * as path from 'path';

type CheckResult = Record<string, any> & { ok: boolean };

@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly s3: S3ArtifactsService,
  ) {}

  /** Public ping — used by load balancers / uptime monitors. */
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

  /** Full system health — super-admin only. */
  @UseGuards(JwtAuthGuard)
  @Get('health/system')
  async systemHealth() {
    const [database, s3, solver, mail, line] = await Promise.all([
      this.checkDatabase(),
      this.checkS3(),
      this.checkSolver(),
      Promise.resolve(this.checkMail()),
      Promise.resolve(this.checkLine()),
    ]);

    const mem = process.memoryUsage();
    const toMb = (n: number) => Math.round(n / 1024 / 1024);

    return {
      checkedAt: new Date().toISOString(),
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV ?? 'development',
        memory: {
          heapUsedMb: toMb(mem.heapUsed),
          heapTotalMb: toMb(mem.heapTotal),
          rssMb: toMb(mem.rss),
        },
      },
      checks: { database, s3, solver, mail, line },
    };
  }

  // ── Individual checks ──────────────────────────────────────────────────────

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  }

  private async checkS3(): Promise<CheckResult> {
    const bucket = process.env.MAYWIN_ARTIFACTS_BUCKET?.trim();
    if (!bucket) {
      return {
        ok: false,
        configured: false,
        error: 'MAYWIN_ARTIFACTS_BUCKET not set — audit logs stored in /tmp (lost on cold start)',
      };
    }
    const start = Date.now();
    try {
      // getText returns null on NoSuchKey, throws on auth/network errors
      await this.s3.getText(['health-ping']);
      return { ok: true, configured: true, bucket, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, configured: true, bucket, error: err?.message ?? String(err) };
    }
  }

  private async checkSolver(): Promise<CheckResult> {
    const cliPath = process.env.SOLVER_CLI_PATH?.trim() ?? 'src/core/solver/solver_cli.py';
    const absPath = path.isAbsolute(cliPath) ? cliPath : path.resolve(process.cwd(), cliPath);
    const pythonCmd = process.env.SOLVER_PYTHON?.trim() ?? (process.platform === 'win32' ? 'py' : 'python3');
    try {
      await access(absPath, constants.R_OK);
      return { ok: true, pythonCmd, cliPath: absPath };
    } catch {
      return { ok: false, pythonCmd, cliPath: absPath, error: 'Solver CLI not found at path' };
    }
  }

  private checkMail(): CheckResult {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const configured = !!(host && user && pass);
    return { ok: configured, configured, host: host ?? null, userSet: !!user };
  }

  private checkLine(): CheckResult {
    const hasSecret = !!process.env.LINE_CHANNEL_SECRET;
    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    return { ok: hasSecret && hasToken, channelSecretSet: hasSecret, accessTokenSet: hasToken };
  }
}
