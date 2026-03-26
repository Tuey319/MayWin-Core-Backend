# MayWin Solver Logic — Technical Reference

> Everything about the schedule optimization solver: what it does, how data flows through it, what inputs and outputs look like, and how to extend it.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Solver Architecture](#2-solver-architecture)
3. [End-to-End Flow](#3-end-to-end-flow)
4. [Phase 1 — Normalization](#4-phase-1--normalization)
5. [Phase 2 — Solving](#5-phase-2--solving)
6. [Phase 3 — Persisting Results](#6-phase-3--persisting-results)
7. [Normalized Input V1 Schema](#7-normalized-input-v1-schema)
8. [Python Solver Request Schema](#8-python-solver-request-schema)
9. [Python Solver Output Schema](#9-python-solver-output-schema)
10. [Solver Plans & Fallback Strategy](#10-solver-plans--fallback-strategy)
11. [Constraint Profile Reference](#11-constraint-profile-reference)
12. [Penalty Weights Reference](#12-penalty-weights-reference)
13. [Job Status Lifecycle](#13-job-status-lifecycle)
14. [Key Source Files](#14-key-source-files)

---

## 1. Overview

The MayWin solver automatically generates nurse shift schedules for a given time horizon. It is an **optimization engine** — not a rule-based greedy algorithm. It uses **Google OR-Tools CP-SAT** (Constraint Programming - Satisfiability) to find an assignment of nurses to shifts that:

- Satisfies hard constraints (e.g. one shift per nurse per day, minimum rest between shifts)
- Meets coverage requirements (minimum/maximum nurses per shift per day)
- Minimizes a weighted objective (understaffing penalties, overtime cost, preference violations, fairness)

The solver is implemented in **Python** and invoked by the NestJS backend as a child process, communicating via JSON files.

---

## 2. Solver Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      NestJS Backend                            │
│                                                                │
│  POST /schedules/:id/jobs                                      │
│         ↓                                                      │
│  JobsService.createJob()        → saves ScheduleJob to DB      │
│         ↓                                                      │
│  JobsRunnerService.enqueue()    → async job queue              │
│         ↓                                                      │
│  NormalizerService.normalize()  → reads DB, builds JSON input  │
│         ↓                                                      │
│  SolverAdapter.solve()          → spawns Python CLI            │
│                                                                │
│          ┌──────────────────────────────────────┐             │
│          │         Python (OR-Tools)            │             │
│          │  solver_cli.py --cli                 │             │
│          │    --input  /tmp/in-<id>.json        │             │
│          │    --output /tmp/out-<id>.json       │             │
│          └──────────────────────────────────────┘             │
│                                                                │
│  SolverAdapter reads output file                               │
│         ↓                                                      │
│  JobsService.applyJob()         → writes ScheduleAssignments  │
└────────────────────────────────────────────────────────────────┘
```

**Key components:**

| File | Responsibility |
|---|---|
| `src/core/jobs/jobs.service.ts` | Job lifecycle: create, poll, preview, apply, cancel |
| `src/core/jobs/jobs-runner.service.ts` | Async queue that orchestrates the full workflow |
| `src/core/normalizer/normalizer.service.ts` | Reads DB → builds `NormalizedInputV1` |
| `src/core/solver/solver.adapter.ts` | Converts v1 input → Python request, spawns CLI, parses output |
| `src/core/solver/solver_cli.py` | Python entry point (OR-Tools solver) |

---

## 3. End-to-End Flow

```
User calls: POST /schedules/:scheduleId/jobs
         ↓
1. JobsService creates ScheduleJob (status: REQUESTED)
2. JobsRunnerService enqueues jobId
         ↓
3. Worker picks up jobId
4. Status → VALIDATED (checks schedule + config exists)
5. Status → NORMALIZING
         ↓
6. NormalizerService.normalize(jobId):
   - Loads workers, availability, preferences, shift templates,
     coverage rules, constraint profile from DB
   - Builds NormalizedInputV1 JSON
   - Saves as ScheduleArtifact (type: NORMALIZED_INPUT)
         ↓
7. Status → SOLVING_A_STRICT
         ↓
8. SolverAdapter.solve(normalizedInput, { plan: 'A_STRICT' }):
   - Converts NormalizedInputV1 → Python request
   - Writes to /tmp/maywin-solver-*/in-<id>.json
   - Spawns: python3 solver_cli.py --cli --input in.json --output out.json
   - Waits up to timeLimitSec (default 30s)
   - Reads /tmp/maywin-solver-*/out-<id>.json
   - Returns { feasible, status, assignments, nurse_stats, understaffed }
         ↓
9. If NOT feasible → Status → SOLVING_A_RELAXED → retry with relaxed constraints
   If still NOT feasible → Status → SOLVING_B_MILP → retry with full MIP
         ↓
10. Status → EVALUATING (validate output integrity)
11. Status → PERSISTING
          ↓
12. Saves SolverRun + SolverRunAssignments to DB
    Saves raw output as ScheduleArtifact (type: SOLVER_OUTPUT)
          ↓
13. Status → COMPLETED
          ↓
User calls: GET /jobs/:jobId/preview   → view proposed schedule
User calls: POST /jobs/:jobId/apply    → write ScheduleAssignments, activate schedule
```

---

## 4. Phase 1 — Normalization

**Service:** `src/core/normalizer/normalizer.service.ts`

The normalizer queries the database and assembles everything the solver needs into a single structured JSON object (`NormalizedInputV1`).

### What it reads from the database

| Data | DB Table | Purpose |
|---|---|---|
| Schedule metadata | `schedules` | Horizon dates (start → end) |
| Workers | `workers` + `worker_unit_memberships` | Who can be assigned |
| Worker availability | `worker_availability` | Which shifts each nurse can work on each day |
| Worker preferences | `worker_preferences` | Penalty scores for undesired shift/day combos |
| Shift templates | `shift_templates` | Shift definitions (code, start time, end time) |
| Coverage rules | `coverage_rules` | Min/max nurses per shift per day type |
| Constraint profile | `constraint_profiles` | All solver settings and penalty weights |

### What it produces

A `NormalizedInputV1` object (see [Section 7](#7-normalized-input-v1-schema)).

Key transformations:
- **Worker codes** (`N001`, `N002`, ...) are deterministically generated from DB IDs for stable round-trip mapping
- **Availability matrix** is built as `{ nurseCode → { date → { shiftCode → 0|1 } } }`
- **Preferences matrix** is built as `{ nurseCode → { date → { shiftCode → penaltyScore } } }`
- **Demand matrix** is built from coverage rules: min workers per shift per day
- **Day types** (`WEEKDAY`, `SATURDAY`, `SUNDAY`, `HOLIDAY`) are derived from date

---

## 5. Phase 2 — Solving

**Adapter:** `src/core/solver/solver.adapter.ts`

The adapter bridges TypeScript and Python.

### Input Conversion (`toSolveRequest()`)

The adapter detects whether input is a `NormalizedInputV1` (from the normalizer) and converts it to the format the Python script expects:

```
NormalizedInputV1
  nurses[]          →  nurses: string[]          (codes only)
  shifts[]          →  shifts: string[]          (codes only)
  horizon.days[]    →  days: string[]            (dates only)
  coverageRules[]   →  demand: { date → { shift → minWorkers } }
  availability{}    →  availability: { same structure }
  preferences{}     →  preferences: { same structure }
  constraints{}     →  weights + per-constraint flags
  nurses[].tags     →  nurse_skills: { code → string[] }
  coverageRules[].requiredTag → required_skills: { date → { shift → { tag → count } } }
  nurses[].isBackup →  backup_nurses: string[]
```

### Python CLI Invocation

```typescript
const py = this.getPythonCmd();    // 'python3' on Linux/Mac, 'py' on Windows
const cli = 'src/core/solver/solver_cli.py';

spawn(py, [cli, '--cli', '--input', inPath, '--output', outPath])
```

The process is given `timeLimitSeconds` to complete. If it times out, status is `TIMEOUT`.

### Output Parsing

After the Python process exits, the adapter reads `outPath` and returns:

```typescript
{
  feasible: boolean,       // true if status is OPTIMAL, FEASIBLE, etc.
  status: string,          // 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'TIMEOUT' | 'ERROR'
  objective: number | null,
  assignments: Assignment[],
  nurse_stats: NurseStat[],
  understaffed: UnderstaffedSlot[],
  meta: { plan, elapsedMs, exitCode }
}
```

---

## 6. Phase 3 — Persisting Results

**Service:** `src/core/jobs/jobs.service.ts`

When `POST /jobs/:jobId/apply` is called:

1. Loads the `SolverRun` for this job (the best feasible solution)
2. Deletes existing `ScheduleAssignment` rows for this schedule (if re-applying)
3. Inserts new `ScheduleAssignment` rows from `SolverRunAssignment`
4. Sets `schedule.is_active = true`
5. Marks job status as `APPLIED`

---

## 7. Normalized Input V1 Schema

This is the canonical internal format produced by `NormalizerService` and consumed by `SolverAdapter`.

```typescript
interface NormalizedInputV1 {
  version: "v1";

  job: {
    jobId: string;
    organizationId: string;
    unitId: string;
    status: string;
  };

  horizon: {
    startDate: string;          // "2026-03-09"
    endDate: string;            // "2026-03-15"
    days: Array<{
      date: string;             // "2026-03-09"
      dayType: "WEEKDAY" | "SATURDAY" | "SUNDAY" | "HOLIDAY";
    }>;
  };

  shifts: Array<{
    code: string;               // "Morning"
    name: string;               // "Morning Shift"
    startTime: string;          // "06:00"
    endTime: string;            // "14:00"
  }>;

  nurses: Array<{
    code: string;               // "N001"
    fullName: string;
    employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT";
    isBackup: boolean;
    maxOvertimeShifts: number;
    regularShiftsPerPeriod: number;
    minShiftsPerPeriod: number;
    tags: string[];             // Skills: ["ICU", "ER"]
  }>;

  coverageRules: Array<{
    shiftCode: string;
    dayType: "WEEKDAY" | "SATURDAY" | "SUNDAY" | "HOLIDAY" | "ALL";
    minWorkers: number;
    maxWorkers: number | null;
    requiredTag: string | null; // Skill requirement, e.g. "ICU"
  }>;

  constraints: {
    // Hard constraint flags
    guaranteeFullCoverage: boolean;
    allowEmergencyOverrides: boolean;
    maxShiftsPerDay: number;            // Usually 1
    minDaysOffPerWeek: number;
    maxNightsPerWeek: number;
    forbidNightToMorning: boolean;      // No night shift followed by morning
    forbidMorningToNightSameDay: boolean;
    forbidEveningToNight: boolean;
    allowSecondShiftSameDayInEmergency: boolean;
    ignoreAvailabilityInEmergency: boolean;
    allowNightCapOverrideInEmergency: boolean;
    allowRestRuleOverrideInEmergency: boolean;

    // Optimization goal flags
    goalMinimizeStaffCost: boolean;
    goalMaximizePreferenceSatisfaction: boolean;
    goalBalanceWorkload: boolean;
    goalBalanceNightWorkload: boolean;
    goalReduceUndesirableShifts: boolean;

    // Penalty weights (see Section 12)
    penaltyWeightJson: PenaltyWeights;
    fairnessWeightJson: FairnessWeights;
    goalPriorityJson: GoalPriority;

    // Solver tuning
    numSearchWorkers: number;   // CPU parallelism (default 8)
    timeLimitSec: number;       // Timeout per plan attempt (default 30)
  };

  // Availability: 0 = unavailable, 1 = available
  availability: {
    [nurseCode: string]: {
      [date: string]: {
        [shiftCode: string]: 0 | 1;
      };
    };
  };

  // Preferences: penalty score if assigned (higher = more undesirable)
  preferences: {
    [nurseCode: string]: {
      [date: string]: {
        [shiftCode: string]: number;
      };
    };
  };
}
```

---

## 8. Python Solver Request Schema

This is what `SolverAdapter.toSolveRequest()` sends to `solver_cli.py`.

```json
{
  "nurses": ["N001", "N002", "N003"],
  "shifts": ["Morning", "Evening", "Night"],
  "days": ["2026-03-09", "2026-03-10", "2026-03-11"],

  "demand": {
    "2026-03-09": {
      "Morning": 3,
      "Evening": 2,
      "Night": 2
    },
    "2026-03-10": {
      "Morning": 3,
      "Evening": 2,
      "Night": 2
    }
  },

  "availability": {
    "N001": {
      "2026-03-09": { "Morning": 1, "Evening": 0, "Night": 0 },
      "2026-03-10": { "Morning": 1, "Evening": 1, "Night": 0 }
    },
    "N002": {
      "2026-03-09": { "Morning": 1, "Evening": 1, "Night": 1 },
      "2026-03-10": { "Morning": 0, "Evening": 1, "Night": 1 }
    }
  },

  "preferences": {
    "N001": {
      "2026-03-09": { "Night": 50 },
      "2026-03-10": { "Morning": 30 }
    }
  },

  "weights": {
    "understaff_penalty": 10000,
    "overtime_penalty": 20,
    "preference_penalty_multiplier": 1,
    "workload_balance_weight": 0,
    "emergency_override_penalty": 500,
    "same_day_second_shift_penalty": 150,
    "weekly_night_over_penalty": 120
  },

  "time_limit_sec": 30,
  "num_search_workers": 8,

  "forbid_night_to_morning": true,
  "forbid_morning_to_night_same_day": false,
  "forbid_evening_to_night": true,
  "max_nights_per_week": 2,
  "min_days_off_per_week": 2,
  "allow_second_shift_same_day_in_emergency": true,

  "backup_nurses": ["N003"],

  "nurse_skills": {
    "N001": ["ICU"],
    "N002": ["ER", "ICU"]
  },

  "required_skills": {
    "2026-03-09": {
      "Night": { "ICU": 1 }
    }
  }
}
```

---

## 9. Python Solver Output Schema

This is what `solver_cli.py` writes to the output file.

```json
{
  "feasible": true,
  "status": "OPTIMAL",
  "objective_value": 1250.5,

  "assignments": [
    {
      "nurse": "N001",
      "date": "2026-03-09",
      "shift": "Morning",
      "emergency_override": false
    },
    {
      "nurse": "N002",
      "date": "2026-03-09",
      "shift": "Evening",
      "emergency_override": false
    },
    {
      "nurse": "N001",
      "date": "2026-03-10",
      "shift": "Night",
      "emergency_override": true
    }
  ],

  "nurse_stats": [
    {
      "nurse": "N001",
      "assigned_shifts": 5,
      "overtime": 1,
      "morning_shifts": 2,
      "evening_shifts": 1,
      "night_shifts": 2,
      "satisfaction": 85
    },
    {
      "nurse": "N002",
      "assigned_shifts": 4,
      "overtime": 0,
      "morning_shifts": 1,
      "evening_shifts": 2,
      "night_shifts": 1,
      "satisfaction": 92
    }
  ],

  "understaffed": [],

  "details": "Solved to optimality in 2.34s"
}
```

### Status Values

| Status | Meaning |
|---|---|
| `OPTIMAL` | Best possible solution found within time limit |
| `FEASIBLE` | A valid solution found (may not be optimal) |
| `EMERGENCY_OPTIMAL` | Optimal with some emergency constraint overrides |
| `RELAXED_OPTIMAL` | Optimal with relaxed constraints (plan A_RELAXED) |
| `HEURISTIC` | Heuristic solution (used as fallback) |
| `INFEASIBLE` | No valid assignment exists under current constraints |
| `TIMEOUT` | Time limit reached before finding a solution |
| `ERROR` | Python process crashed or produced invalid output |

The TypeScript adapter treats `OPTIMAL`, `FEASIBLE`, `EMERGENCY_OPTIMAL`, `RELAXED_OPTIMAL`, and `HEURISTIC` as **feasible** (a usable schedule was produced).

---

## 10. Solver Plans & Fallback Strategy

The runner attempts up to 3 plans in sequence, stopping at the first feasible result:

```
Plan A_STRICT
  All hard constraints enforced.
  Availability is respected.
  Rest rules enforced (forbidNightToMorning, etc.)
  Coverage requirements: hard constraint.
         ↓ (if INFEASIBLE)
Plan A_RELAXED
  Emergency overrides allowed (allowEmergencyOverrides: true).
  Some rest rules can be bypassed (allowRestRuleOverrideInEmergency).
  Night cap overrides allowed (allowNightCapOverrideInEmergency).
  Coverage still attempted but emergency assignments incur penalty.
         ↓ (if still INFEASIBLE)
Plan B_MILP
  Full Mixed Integer Linear Programming fallback.
  Strongest guarantees but slowest.
  Used as last resort.
```

This fallback chain is implemented in `JobsRunnerService` by calling `SolverAdapter.solve()` multiple times with different `opts.plan` values.

---

## 11. Constraint Profile Reference

A `ConstraintProfile` is stored per organization and linked to a schedule job. It defines all solver parameters.

**File:** `src/database/entities/scheduling/constraint-profile.entity.ts`

| Field | Type | Description |
|---|---|---|
| `guaranteeFullCoverage` | boolean | Treat coverage as a hard constraint |
| `allowEmergencyOverrides` | boolean | Allow emergency assignments bypassing some rules |
| `maxShiftsPerDay` | number | Max shifts per nurse per day (usually 1) |
| `minDaysOffPerWeek` | number | Minimum rest days per week per nurse |
| `maxNightsPerWeek` | number | Max night shifts per week per nurse |
| `forbidNightToMorning` | boolean | No morning shift after a night shift |
| `forbidMorningToNightSameDay` | boolean | No night after morning on the same day |
| `forbidEveningToNight` | boolean | No night shift after an evening shift |
| `allowSecondShiftSameDayInEmergency` | boolean | Allow double-shift in emergency |
| `ignoreAvailabilityInEmergency` | boolean | Override availability rules in emergency |
| `allowNightCapOverrideInEmergency` | boolean | Exceed night cap in emergency |
| `allowRestRuleOverrideInEmergency` | boolean | Override rest rules in emergency |
| `goalMinimizeStaffCost` | boolean | Include cost minimization in objective |
| `goalMaximizePreferenceSatisfaction` | boolean | Include preference satisfaction |
| `goalBalanceWorkload` | boolean | Balance total shifts across nurses |
| `goalBalanceNightWorkload` | boolean | Balance night shifts across nurses |
| `goalReduceUndesirableShifts` | boolean | Penalize high-preference-penalty assignments |
| `penaltyWeightJson` | JSON | Penalty weight values (see Section 12) |
| `fairnessWeightJson` | JSON | Fairness objective weights |
| `goalPriorityJson` | JSON | Priority ordering of objectives |
| `numSearchWorkers` | number | OR-Tools CPU threads (default 8) |
| `timeLimitSec` | number | Max time per plan attempt (default 30) |

---

## 12. Penalty Weights Reference

Defined in `penaltyWeightJson` on the `ConstraintProfile`.

| Key | Default | Description |
|---|---|---|
| `understaff_penalty` | `10000` | Cost per understaffed slot (high = hard requirement) |
| `overtime_penalty` | `20` | Cost per overtime shift assigned |
| `preference_penalty_multiplier` | `1` | Multiplier applied to worker preference scores |
| `workload_balance_weight` | `0` | Weight for workload balance objective |
| `emergency_override_penalty` | `500` | Penalty per emergency override used |
| `same_day_second_shift_penalty` | `150` | Penalty for double shifts in one day |
| `weekly_night_over_penalty` | `120` | Penalty for exceeding weekly night cap |

**Fairness weights (`fairnessWeightJson`):**

| Key | Description |
|---|---|
| `workload_balance` | Weight for balancing total assigned shifts |
| `night_balance` | Weight for balancing night shift distribution |
| `shift_type_balance` | Weight for balancing morning/evening/night mix |

**Goal priority (`goalPriorityJson`):**

Lower number = higher priority. The solver will prioritize objectives accordingly.

| Key | Suggested Value |
|---|---|
| `coverage` | `1` (highest priority) |
| `cost` | `2` |
| `preference` | `3` |
| `fairness` | `4` |

---

## 13. Job Status Lifecycle

```
REQUESTED
  ↓  (picked up by JobsRunnerService)
VALIDATED
  ↓  (checks schedule, config, workers exist)
NORMALIZING
  ↓  (NormalizerService runs)
SOLVING_A_STRICT
  ↓  (SolverAdapter runs plan A)
  ├──[feasible]──→ EVALUATING
  └──[infeasible]─→ SOLVING_A_RELAXED
                      ↓
                      ├──[feasible]──→ EVALUATING
                      └──[infeasible]─→ SOLVING_B_MILP
                                          ↓
                                          ├──[feasible]──→ EVALUATING
                                          └──[infeasible]─→ FAILED
EVALUATING
  ↓  (validates output integrity)
PERSISTING
  ↓  (saves SolverRun + SolverRunAssignments + artifacts)
COMPLETED
  ↓  (user reviews via GET /jobs/:jobId/preview)
APPLIED
     (user calls POST /jobs/:jobId/apply → writes ScheduleAssignments)
```

**Error states:**
- `FAILED` — All plans infeasible or unrecoverable error
- `CANCELLED` — User called `POST /jobs/:jobId/cancel`

---

## 14. Key Source Files

| File | Description |
|---|---|
| [src/core/normalizer/normalizer.service.ts](../src/core/normalizer/normalizer.service.ts) | DB → NormalizedInputV1 conversion |
| [src/core/solver/solver.adapter.ts](../src/core/solver/solver.adapter.ts) | NormalizedInputV1 → Python request, CLI spawner, output parser |
| [src/core/solver/solver_cli.py](../src/core/solver/solver_cli.py) | Python OR-Tools CP-SAT solver entry point |
| [src/core/jobs/jobs.service.ts](../src/core/jobs/jobs.service.ts) | Job CRUD: create, poll, preview, apply, cancel |
| [src/core/jobs/jobs-runner.service.ts](../src/core/jobs/jobs-runner.service.ts) | Async job queue and workflow orchestration |
| [src/core/orchestrator/](../src/core/orchestrator/) | AWS Step Functions or local runner selection |
| [src/database/entities/scheduling/constraint-profile.entity.ts](../src/database/entities/scheduling/constraint-profile.entity.ts) | Constraint profile schema |
| [src/database/entities/orchestration/](../src/database/entities/orchestration/) | ScheduleJob, SolverRun, SolverRunAssignment, ScheduleArtifact |

---

*For how to add new endpoints to the backend, see [BACKEND_DEVELOPER_GUIDE.md](./BACKEND_DEVELOPER_GUIDE.md).*
*For full API reference, see [API.md](./API.md).*
