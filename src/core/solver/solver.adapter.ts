// src/core/solver/solver.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

export type SolverPlan = 'A_STRICT' | 'A_RELAXED' | 'B_MILP';

export interface SolveOptions {
  jobId?: string;
  plan?: SolverPlan;
  timeLimitSeconds?: number;
}

export interface CliSolveResponse {
  feasible?: boolean;
  status?: string;
  objective?: number | null;
  assignments?: any[];
  nurse_stats?: any[];
  understaffed?: any[];
  meta?: Record<string, any>;
  details?: any;
}

@Injectable()
export class SolverAdapter {
  private readonly logger = new Logger(SolverAdapter.name);

  private getPythonCmd(): string {
    return (
      process.env.SOLVER_PYTHON?.trim() ||
      (process.platform === 'win32' ? 'py' : 'python3')
    );
  }

  private getCliPath(): string {
    const p =
      process.env.SOLVER_CLI_PATH?.trim() || 'src/core/solver/solver_cli.py';
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }

  async solve(
    input: Record<string, any>,
    opts?: SolveOptions,
  ): Promise<Record<string, any>> {
    return this.solveViaCli(input, opts);
  }

  private async solveViaCli(
    input: Record<string, any>,
    opts?: SolveOptions,
  ): Promise<Record<string, any>> {
    const jobId = opts?.jobId ?? null;
    const plan = opts?.plan ?? 'A_STRICT';
    const timeLimitSeconds = opts?.timeLimitSeconds ?? 30;

    // Detect NormalizedInput.v1 (rich objects from NormalizerService)
    const looksLikeNormalizedInput =
      input?.horizon?.days &&
      Array.isArray(input?.horizon?.days) &&
      Array.isArray(input?.nurses) &&
      input?.nurses?.[0]?.code &&
      Array.isArray(input?.shifts) &&
      input?.shifts?.[0]?.code;

    const pythonReq = looksLikeNormalizedInput
      ? this.toSolveRequest(input, timeLimitSeconds)
      : input;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maywin-solver-'));
    const reqId = crypto.randomUUID();
    const inPath = path.join(tmpDir, `in-${reqId}.json`);
    const outPath = path.join(tmpDir, `out-${reqId}.json`);

    try {
      await fs.writeFile(inPath, JSON.stringify(pythonReq), 'utf8');

      const py = this.getPythonCmd();
      const cli = this.getCliPath();
      const args: string[] = [cli, '--cli', '--input', inPath, '--output', outPath];

      const startedAt = Date.now();
      const { code, stdout, stderr, timedOut } = await this.spawnAndWait(
        py,
        args,
        timeLimitSeconds,
      );
      const elapsedMs = Date.now() - startedAt;

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
          nurse_stats: [],
          understaffed: [],
          details: `Solver timed out after ${timeLimitSeconds}s`,
          meta: { plan, jobId, elapsedMs, cliPath: cli },
        };
      }

      if (code !== 0 && !parsed) {
        return {
          feasible: false,
          status: 'ERROR',
          assignments: [],
          nurse_stats: [],
          understaffed: [],
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

      const status: string | undefined = parsed?.status;
      const assignments = Array.isArray(parsed?.assignments) ? parsed.assignments : [];
      const nurseStats = Array.isArray(parsed?.nurse_stats) ? parsed.nurse_stats : [];
      const understaffed = Array.isArray(parsed?.understaffed) ? parsed.understaffed : [];

      // app3.py statuses that indicate a usable schedule
      const feasible =
        status === 'OPTIMAL' ||
        status === 'FEASIBLE' ||
        status === 'EMERGENCY_OPTIMAL' ||
        status === 'EMERGENCY_FEASIBLE' ||
        status === 'RELAXED_OPTIMAL' ||
        status === 'RELAXED_FEASIBLE' ||
        status === 'HEURISTIC';

      return {
        feasible,
        status: status ?? undefined,
        objective: parsed?.objective_value ?? null,
        assignments,
        nurse_stats: nurseStats,
        understaffed,
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
        nurse_stats: [],
        understaffed: [],
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
   * Convert NormalizedInput.v1 (from NormalizerService) → app3.py SolveRequest.
   *
   * Nurse-level fields added by normalizer v3:
   *   isBackup, maxOvertimeShifts, regularShiftsPerPeriod, minShiftsPerPeriod, tags (skills)
   *
   * Constraint fields added by normalizer v3 (from ConstraintProfile):
   *   guaranteeFullCoverage, allowEmergencyOverrides,
   *   maxShiftsPerDay, minDaysOffPerWeek, maxNightsPerWeek,
   *   forbidNightToMorning, forbidMorningToNightSameDay,
   *   allowSecondShiftSameDayInEmergency, ignoreAvailabilityInEmergency,
   *   allowNightCapOverrideInEmergency, allowRestRuleOverrideInEmergency,
   *   goalMinimizeStaffCost, goalMaximizePreferenceSatisfaction,
   *   goalBalanceWorkload, goalBalanceNightWorkload, goalReduceUndesirableShifts,
   *   penaltyWeightJson, fairnessWeightJson, goalPriorityJson,
   *   numSearchWorkers, timeLimitSec
   */
  private toSolveRequest(normalized: any, fallbackTimeLimitSec: number): Record<string, any> {
    const days: string[] = (normalized?.horizon?.days ?? []).map((d: any) =>
      String(d.date),
    );
    const shifts: string[] = (normalized?.shifts ?? []).map((s: any) =>
      String(s.code),
    );
    const nurses: string[] = (normalized?.nurses ?? []).map((n: any) =>
      String(n.code),
    );

    // ── demand ────────────────────────────────────────────────────────────────
    const demand: Record<string, Record<string, number>> = {};

    for (const day of normalized?.horizon?.days ?? []) {
      const date = String(day.date);
      const dayType = String(day.dayType);
      demand[date] = {};
      for (const sc of shifts) {
        const rule = (normalized?.coverageRules ?? []).find(
          (r: any) => String(r.shiftCode) === sc && String(r.dayType) === dayType,
        );
        demand[date][sc] = rule?.minWorkers != null ? Number(rule.minWorkers) : 0;
      }
    }

    // ── availability ─────────────────────────────────────────────────────────
    const availability: Record<string, Record<string, Record<string, number>>> = {};
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
      if (!availability[nurse]) availability[nurse] = {};
      if (!availability[nurse][date]) availability[nurse][date] = {};

      // 0 = unavailable, 1 = available (default)
      // PREFERRED only marks the named shift as explicitly available — it does NOT block
      // other shifts on the same day. To enforce "shift X only", add UNAVAILABLE rows
      // for all other shifts on that day in worker_availability.
      if (type === 'UNAVAILABLE' || type === 'BLOCKED' || type === 'DAY_OFF') {
        if (sc.toUpperCase() === 'ALL') {
          // shift_code='ALL' means block every shift on this day
          for (const shiftCode of shifts) {
            availability[nurse][date][shiftCode] = 0;
          }
        } else {
          availability[nurse][date][sc] = 0;
        }
      } else {
        // PREFERRED, AVAILABLE, or any other type → available
        availability[nurse][date][sc] = 1;
      }
    }

    // ── preferences ───────────────────────────────────────────────────────────
    let preferences: Record<string, Record<string, Record<string, number>>> | undefined;
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
            const penalty = Math.trunc(Number(byShift[shift]));
            if (!Number.isFinite(penalty) || penalty <= 0) continue;
            cleaned[nurse] = cleaned[nurse] ?? {};
            cleaned[nurse][date] = cleaned[nurse][date] ?? {};
            cleaned[nurse][date][shift] = penalty;
          }
        }
      }
      if (Object.keys(cleaned).length > 0) preferences = cleaned;
    }

    // ── per-nurse overrides ───────────────────────────────────────────────────
    const backupNurses: string[] = [];
    const nurseSkills: Record<string, string[]> = {};
    const regularShiftsPerNurse: Record<string, number> = {};
    const maxOvertimePerNurse: Record<string, number> = {};
    const minTotalShiftsPerNurse: Record<string, number> = {};

    for (const n of normalized?.nurses ?? []) {
      const code = String(n.code);

      if (n.isBackup === true) backupNurses.push(code);

      const skills: string[] = Array.isArray(n.tags) ? n.tags.filter(Boolean).map(String) : [];
      if (skills.length > 0) nurseSkills[code] = skills;

      if (n.regularShiftsPerPeriod != null && Number.isFinite(Number(n.regularShiftsPerPeriod))) {
        regularShiftsPerNurse[code] = Number(n.regularShiftsPerPeriod);
      }
      if (n.maxOvertimeShifts != null && Number.isFinite(Number(n.maxOvertimeShifts))) {
        maxOvertimePerNurse[code] = Number(n.maxOvertimeShifts);
      }
      if (n.minShiftsPerPeriod != null && Number.isFinite(Number(n.minShiftsPerPeriod))) {
        minTotalShiftsPerNurse[code] = Number(n.minShiftsPerPeriod);
      }
    }

    // ── required skills from coverage rules ───────────────────────────────────
    // coverageRules have: { shiftCode, dayType, requiredTag }
    // Build: { date: { shiftCode: { skill: 1 } } }
    const requiredSkills: Record<string, Record<string, Record<string, number>>> = {};
    for (const day of normalized?.horizon?.days ?? []) {
      const date = String(day.date);
      const dayType = String(day.dayType);
      for (const rule of normalized?.coverageRules ?? []) {
        if (!rule.requiredTag) continue;
        if (String(rule.dayType) !== dayType) continue;
        const sc = String(rule.shiftCode);
        requiredSkills[date] = requiredSkills[date] ?? {};
        requiredSkills[date][sc] = requiredSkills[date][sc] ?? {};
        requiredSkills[date][sc][String(rule.requiredTag)] =
          (requiredSkills[date][sc][String(rule.requiredTag)] ?? 0) + 1;
      }
    }

    // ── constraints → Rules, Weights, GoalPriority, FairnessWeights ──────────
    const cp = normalized?.constraints ?? {};
    const penaltyWeightJson = cp.penaltyWeightJson ?? {};
    const fairnessWeightJson = cp.fairnessWeightJson ?? {};
    const goalPriorityJson = cp.goalPriorityJson ?? {};

    const rules: Record<string, any> = {
      guarantee_full_coverage: cp.guaranteeFullCoverage ?? true,
      allow_emergency_overrides: cp.allowEmergencyOverrides ?? true,
      max_shifts_per_day: cp.maxShiftsPerDay ?? 1,
      max_consecutive_work_days: cp.maxConsecutiveWorkDays ?? null,
      max_consecutive_shifts: cp.maxConsecutiveShifts ?? undefined,
      min_days_off_per_week: cp.minDaysOffPerWeek ?? 2,
      max_nights_per_week: cp.maxNightsPerWeek ?? 2,
      min_rest_hours_between_shifts: cp.minRestHoursBetweenShifts ?? null,
      forbid_night_to_morning: cp.forbidNightToMorning ?? true,
      forbid_morning_to_night_same_day: cp.forbidMorningToNightSameDay ?? false,
      forbid_evening_to_night: cp.forbidEveningToNight ?? true,
      allow_second_shift_same_day_in_emergency: cp.allowSecondShiftSameDayInEmergency ?? true,
      ignore_availability_in_emergency: cp.ignoreAvailabilityInEmergency ?? false,
      allow_night_cap_override_in_emergency: cp.allowNightCapOverrideInEmergency ?? true,
      allow_rest_rule_override_in_emergency: cp.allowRestRuleOverrideInEmergency ?? true,
      goal_minimize_staff_cost: cp.goalMinimizeStaffCost ?? true,
      goal_maximize_preference_satisfaction: cp.goalMaximizePreferenceSatisfaction ?? true,
      goal_balance_workload: cp.goalBalanceWorkload ?? false,
      goal_balance_night_workload: cp.goalBalanceNightWorkload ?? false,
      goal_reduce_undesirable_shifts: cp.goalReduceUndesirableShifts ?? true,
      enable_shift_type_limit: cp.enableShiftTypeLimit ?? true,
      max_shift_per_type: cp.maxShiftPerType ?? { morning: 9, evening: 9, night: 9 },
      shift_type_limit_exempt_nurses: cp.shiftTypeLimitExemptNurses ?? [],
      evening_after_morning_counts_as_overtime: cp.eveningAfterMorningCountsAsOvertime ?? true,
      enable_consecutive_night_limit: cp.enableConsecutiveNightLimit ?? true,
      max_consecutive_night_shifts: cp.maxConsecutiveNightShifts ?? 3,
      enable_min_total_days_off: cp.enableMinTotalDaysOff ?? true,
      min_total_days_off: cp.minTotalDaysOff ?? 11,
    };

    const weights: Record<string, any> = {
      understaff_penalty: penaltyWeightJson.understaff_penalty ?? 10000,
      overtime_penalty: penaltyWeightJson.overtime_penalty ?? 20,
      preference_penalty_multiplier: penaltyWeightJson.preference_penalty_multiplier ?? 1,
      workload_balance_weight: penaltyWeightJson.workload_balance_weight ?? 0,
      emergency_override_penalty: penaltyWeightJson.emergency_override_penalty ?? 500,
      same_day_second_shift_penalty: penaltyWeightJson.same_day_second_shift_penalty ?? 150,
      weekly_night_over_penalty: penaltyWeightJson.weekly_night_over_penalty ?? 120,
      evening_to_night_penalty: penaltyWeightJson.evening_to_night_penalty ?? 10000,
      shift_type_balance_penalty: penaltyWeightJson.shift_type_balance_penalty ?? 100,
      overtime_balance_penalty: penaltyWeightJson.overtime_balance_penalty ?? 1000,
    };

    const goalPriority: Record<string, any> = {
      coverage: goalPriorityJson.coverage ?? 1,
      cost: goalPriorityJson.cost ?? 2,
      preference: goalPriorityJson.preference ?? 3,
      fairness: goalPriorityJson.fairness ?? 4,
    };

    const fairnessWeights: Record<string, any> = {
      workload_balance: fairnessWeightJson.workload_balance ?? 1,
      night_balance: fairnessWeightJson.night_balance ?? 1,
      shift_type_balance: fairnessWeightJson.shift_type_balance ?? 1,
    };

    const timeLimitSec = cp.timeLimitSec ?? fallbackTimeLimitSec;
    const numSearchWorkers = cp.numSearchWorkers ?? 8;

    // ── assemble final request ────────────────────────────────────────────────
    // The AWS lambda SolveRequest expects constraint flags as TOP-LEVEL fields,
    // not nested under a "rules" object.
    const req: Record<string, any> = {
      nurses,
      shifts,
      days,
      demand,
      availability,
      weights,
      rules,
      goal_priority: goalPriority,
      fairness_weights: fairnessWeights,
      time_limit_sec: timeLimitSec,
      num_search_workers: numSearchWorkers,
      max_shifts_per_day: cp.maxShiftsPerDay ?? 1,
      min_days_off_per_week: cp.minDaysOffPerWeek ?? 2,
      // Shift-sequence toggles — top-level fields consumed by the lambda solver
      forbid_evening_to_night: cp.forbidEveningToNight ?? true,
      forbid_night_to_morning: cp.forbidNightToMorning ?? true,
      forbid_morning_to_night_same_day: cp.forbidMorningToNightSameDay ?? false,
      ignore_availability_in_emergency: cp.ignoreAvailabilityInEmergency ?? false,
      max_nights_per_week: cp.maxNightsPerWeek ?? 2,
    };

    if (preferences) req.preferences = preferences;

    if (backupNurses.length > 0) req.backup_nurses = backupNurses;
    if (Object.keys(nurseSkills).length > 0) req.nurse_skills = nurseSkills;
    if (Object.keys(regularShiftsPerNurse).length > 0) req.regular_shifts_per_nurse = regularShiftsPerNurse;
    if (Object.keys(maxOvertimePerNurse).length > 0) req.max_overtime_per_nurse = maxOvertimePerNurse;
    if (Object.keys(minTotalShiftsPerNurse).length > 0) req.min_total_shifts_per_nurse = minTotalShiftsPerNurse;
    if (Object.keys(requiredSkills).length > 0) req.required_skills = requiredSkills;

    return req;
  }

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
        try { child.kill('SIGKILL'); } catch {}
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
