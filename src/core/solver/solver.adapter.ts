// src/core/solver/solver.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Solver plan types for optimization strategies
 */
export type SolverPlan = 'A_STRICT' | 'A_RELAXED' | 'B_MILP';

/**
 * Options for configuring solver execution
 */
export interface SolveOptions {
  /** Unique identifier for the solve job */
  jobId?: string;
  /** Strategy plan to use for solving */
  plan?: SolverPlan;
  /** Maximum time allowed for solving in seconds */
  timeLimitSeconds?: number;
}

/**
 * Response structure from CLI solver execution
 */
export interface CliSolveResponse {
  /** Whether a feasible solution was found */
  feasible?: boolean;
  /** Status of the solve operation */
  status?: string; // OPTIMAL/FEASIBLE/INFEASIBLE/UNKNOWN/TIMEOUT/ERROR
  /** Objective function value */
  objective?: number | null;
  /** Array of assignments in the solution */
  assignments?: any[];
  /** Additional metadata about the solve operation */
  meta?: Record<string, any>;
  /** Detailed information (can be string or object from Python) */
  details?: any;
}

/**
 * Adapter service for interfacing with the Python-based solver CLI
 *
 * This service manages the execution of optimization problems by:
 * - Spawning Python solver processes
 * - Managing temporary file I/O for solver input/output
 * - Converting between TypeScript and Python data structures
 * - Handling timeouts and error conditions
 *
 * @remarks
 * Configure via environment variables:
 * - SOLVER_PYTHON: Python command ("python", "python3", "py")
 * - SOLVER_CLI_PATH: Path to solver_cli.py script
 */
@Injectable()
export class SolverAdapter {
  private readonly logger = new Logger(SolverAdapter.name);

  /**
   * Gets the Python command to use for spawning solver processes
   *
   * Configured via SOLVER_PYTHON environment variable.
   * Defaults to 'py' on Windows, 'python3' on Unix-like systems.
   *
   * @returns Python command string
   *
   * @example
   * Windows: SOLVER_PYTHON=py
   * Linux/Mac: SOLVER_PYTHON=python3
   */
  private getPythonCmd(): string {
    return (
      process.env.SOLVER_PYTHON?.trim() ||
      (process.platform === 'win32' ? 'py' : 'python3')
    );
  }

  /**
   * Gets the absolute path to the solver CLI script
   *
   * Configured via SOLVER_CLI_PATH environment variable.
   * Defaults to 'src/core/solver/solver_cli.py' relative to process.cwd().
   *
   * @returns Absolute path to solver CLI script
   *
   * @example
   * SOLVER_CLI_PATH=src/core/solver/solver_cli.py
   */
  private getCliPath(): string {
    const p =
      process.env.SOLVER_CLI_PATH?.trim() || 'src/core/solver/solver_cli.py';
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }

  /**
   * Main entry point for solving optimization problems
   *
   * @param input - Problem input data (either NormalizedInput.v1 or Python SolveRequest format)
   * @param opts - Optional solver configuration
   * @returns Promise resolving to solve results
   */
  async solve(
    input: Record<string, any>,
    opts?: SolveOptions,
  ): Promise<Record<string, any>> {
    return this.solveViaCli(input, opts);
  }

  /**
   * Executes the Python solver CLI using temporary files for I/O
   *
   * Process:
   * 1. Detects and converts input format if needed
   * 2. Creates temporary directory for file I/O
   * 3. Writes input JSON to temp file
   * 4. Spawns Python process: <python> <cliPath> --cli --input <in.json> --output <out.json>
   * 5. Reads and parses output JSON
   * 6. Handles timeouts and errors
   * 7. Cleans up temporary files
   *
   * @param input - Problem input data
   * @param opts - Optional solver configuration
   * @returns Promise resolving to solve results with status, assignments, and metadata
   *
   * @private
   */
  private async solveViaCli(
    input: Record<string, any>,
    opts?: SolveOptions,
  ): Promise<Record<string, any>> {
    const jobId = opts?.jobId ?? null;
    const plan = opts?.plan ?? 'A_STRICT';
    const timeLimitSeconds = opts?.timeLimitSeconds ?? 30;

    // Detect if "input" is NormalizedInput.v1 (rich objects) and convert to Python SolveRequest.
    const looksLikeNormalizedInput =
      input?.horizon?.days &&
      Array.isArray(input?.horizon?.days) &&
      Array.isArray(input?.nurses) &&
      input?.nurses?.[0]?.code &&
      Array.isArray(input?.shifts) &&
      input?.shifts?.[0]?.code;

    const pythonReq = looksLikeNormalizedInput ? this.toSolveRequest(input) : input;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maywin-solver-'));
    const reqId = crypto.randomUUID();
    const inPath = path.join(tmpDir, `in-${reqId}.json`);
    const outPath = path.join(tmpDir, `out-${reqId}.json`);

    try {
      await fs.writeFile(inPath, JSON.stringify(pythonReq), 'utf8');

      const py = this.getPythonCmd();
      const cli = this.getCliPath();

      // Python CLI supports: --cli --input <file> --output <file>
      const args: string[] = [cli, '--cli', '--input', inPath, '--output', outPath];

      const startedAt = Date.now();
      const { code, stdout, stderr, timedOut } = await this.spawnAndWait(
        py,
        args,
        timeLimitSeconds,
      );
      const elapsedMs = Date.now() - startedAt;

      // Prefer output file JSON (Python writes it even on errors)
      let parsed: any = null;
      try {
        const raw = await fs.readFile(outPath, 'utf8');
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      if (timedOut) {
        return {
          feasible: false,
          status: 'TIMEOUT',
          assignments: [],
          details: `Solver timed out after ${timeLimitSeconds}s`,
          meta: { plan, jobId, elapsedMs, cliPath: cli },
        };
      }

      // If python exited nonzero and didn't produce JSON, surface stdout/stderr
      if (code !== 0 && !parsed) {
        return {
          feasible: false,
          status: 'ERROR',
          assignments: [],
          details: `Solver CLI exited with code=${code}`,
          meta: {
            plan,
            jobId,
            elapsedMs,
            cliPath: cli,
            stdout: stdout?.slice(0, 4000),
            stderr: stderr?.slice(0, 4000),
          },
        };
      }

      // Normalize Python SolveResponse -> your runner expectations
      const status: string | undefined = parsed?.status;
      const assignments = Array.isArray(parsed?.assignments) ? parsed.assignments : [];

      // "feasible" may not exist; infer from status
      const feasible =
        status === 'OPTIMAL' ||
        status === 'FEASIBLE' ||
        status === 'RELAXED_OPTIMAL' ||
        status === 'RELAXED_FEASIBLE' ||
        status === 'HEURISTIC';

      return {
        feasible,
        status: status ?? undefined,
        objective: parsed?.objective_value ?? null,
        assignments,
        details: parsed?.details ?? undefined,
        meta: {
          ...(parsed?.details ? { solverDetails: parsed.details } : {}),
          plan,
          jobId,
          elapsedMs,
          cliPath: cli,
          exitCode: code,
          stdout: stdout?.slice(0, 4000),
          stderr: stderr?.slice(0, 4000),
        },
      };
    } catch (e: any) {
      this.logger.error(`SolverAdapter CLI failed: ${e?.message ?? e}`);
      return {
        feasible: false,
        status: 'ERROR',
        assignments: [],
        details: e?.message ?? String(e),
        meta: { plan, jobId, error: true },
      };
    } finally {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  /**
   * Converts NormalizedInput.v1 (rich objects) to Python SolveRequest (flat schema)
   *
   * Transforms TypeScript domain objects into the flat structure expected by Python solver:
   * - nurses: Array of nurse codes
   * - shifts: Array of shift codes
   * - days: Array of date strings
   * - demand: Nested dict of {date: {shift: minWorkers}}
   * - availability: Nested dict of {nurse: {date: {shift: available}}}
   * - preferences (optional): Nested dict of {nurse: {date: {shift: penalty}}}
   *
   * @param normalized - Input data in NormalizedInput.v1 format
   * @returns Converted data in Python SolveRequest format
   *
   * @remarks
   * Python expects availability as: dict[nurse][day] = dict[shift] = bool (NOT list)
   *
   * @private
   */
  private toSolveRequest(normalized: any) {
    // Days: ['2025-01-01', ...]
    const days: string[] = (normalized?.horizon?.days ?? []).map((d: any) =>
      String(d.date),
    );

    // Shifts: ['D','N',...]
    const shifts: string[] = (normalized?.shifts ?? []).map((s: any) =>
      String(s.code),
    );

    // Nurses: ['W001','W002',...]
    const nurses: string[] = (normalized?.nurses ?? []).map((n: any) =>
      String(n.code),
    );

    // demand[date][shift] = minWorkers (or 0)
    const demand: Record<string, Record<string, number>> = {};
    for (const day of normalized?.horizon?.days ?? []) {
      const date = String(day.date);
      const dayType = String(day.dayType); // WEEKDAY / WEEKEND
      demand[date] = {};

      for (const sc of shifts) {
        const rule = (normalized?.coverageRules ?? []).find(
          (r: any) => String(r.shiftCode) === sc && String(r.dayType) === dayType,
        );
        demand[date][sc] = rule?.minWorkers != null ? Number(rule.minWorkers) : 0;
      }
    }

    // ✅ availability[nurse][date] = { D: true, N: true }
    const availability: Record<string, Record<string, Record<string, boolean>>> =
      {};

    // init empty dicts
    for (const n of nurses) {
      availability[n] = {};
      for (const d of days) availability[n][d] = {};
    }

    for (const row of normalized?.availability ?? []) {
      const nurse = row?.nurseCode ? String(row.nurseCode) : null;
      const date = row?.date ? String(row.date) : null;
      const sc = row?.shiftCode ? String(row.shiftCode) : null;
      const type = row?.type ? String(row.type) : null;

      if (!nurse || !date || !sc) continue;

      // Safer default: only block explicit "UNAVAILABLE"/"BLOCKED"
      if (type === 'UNAVAILABLE' || type === 'BLOCKED') continue;

      if (!availability[nurse]) availability[nurse] = {};
      if (!availability[nurse][date]) availability[nurse][date] = {};

      availability[nurse][date][sc] = true;
    }

    // ✅ preferences[nurse][date][shift] = penalty (optional)
    // We forward it only if it is an object; we also sanitize values to be integers >= 0.
    let preferences:
      | Record<string, Record<string, Record<string, number>>>
      | undefined;

    const rawPrefs = normalized?.preferences;
    if (rawPrefs && typeof rawPrefs === 'object') {
      const cleaned: Record<string, Record<string, Record<string, number>>> = {};

      for (const nurse of Object.keys(rawPrefs)) {
        const byDate = rawPrefs[nurse];
        if (!byDate || typeof byDate !== 'object') continue;

        for (const date of Object.keys(byDate)) {
          const byShift = byDate[date];
          if (!byShift || typeof byShift !== 'object') continue;

          for (const shift of Object.keys(byShift)) {
            const val = Number(byShift[shift]);
            if (!Number.isFinite(val)) continue;

            const penalty = Math.trunc(val);
            if (penalty < 0) continue;

            cleaned[nurse] = cleaned[nurse] ?? {};
            cleaned[nurse][date] = cleaned[nurse][date] ?? {};
            cleaned[nurse][date][shift] = penalty;
          }
        }
      }

      if (Object.keys(cleaned).length > 0) preferences = cleaned;
    }

    const req: Record<string, any> = { nurses, shifts, days, demand, availability };
    if (preferences) req.preferences = preferences;

    return req;
  }

  /**
   * Spawns a child process and waits for completion with timeout
   *
   * @param cmd - Command to execute (e.g., 'python3')
   * @param args - Array of command-line arguments
   * @param timeLimitSeconds - Maximum execution time in seconds
   * @returns Promise resolving to process results including exit code, stdout, stderr, and timeout status
   *
   * @remarks
   * - Captures stdout and stderr streams
   * - Kills process with SIGKILL if timeout is exceeded
   * - Adds 500ms grace period to timeout before killing
   *
   * @private
   */
  private spawnAndWait(
    cmd: string,
    args: string[],
    timeLimitSeconds: number,
  ): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let done = false;
      let timedOut = false;

      const killTimer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {}
      }, Math.max(1, timeLimitSeconds) * 1000 + 500);

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('error', (err) => {
        if (done) return;
        done = true;
        clearTimeout(killTimer);
        reject(err);
      });

      child.on('close', (code) => {
        if (done) return;
        done = true;
        clearTimeout(killTimer);
        resolve({ code, stdout, stderr, timedOut });
      });
    });
  }
}
