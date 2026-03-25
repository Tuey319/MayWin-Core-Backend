# MayWin System Documentation

Comprehensive technical reference covering business logic, orchestration, solver, deployment, and DevOps.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Domain Model & Business Logic](#2-domain-model--business-logic)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Schedule Lifecycle](#4-schedule-lifecycle)
5. [Job Orchestration Workflow](#5-job-orchestration-workflow)
6. [Solver Architecture](#6-solver-architecture)
7. [Normalizer Service](#7-normalizer-service)
8. [Worker Messaging & LINE Chatbot](#8-worker-messaging--line-chatbot)
9. [Database Schema](#9-database-schema)
10. [Configuration Reference](#10-configuration-reference)
11. [Deployment & Infrastructure](#11-deployment--infrastructure)
12. [DevOps & Local Development](#12-devops--local-development)

---

## 1. System Overview

MayWin is an automated nurse scheduling platform for hospitals. The system accepts availability, shift preferences, and coverage requirements from nursing staff and managers, then uses a constraint-programming optimizer to generate schedules that satisfy both hard labor rules and soft worker preferences.

### High-Level Architecture

```
Browser (Next.js BFF)
        │
        │ HTTPS / JWT
        ▼
┌─────────────────────────────────────┐
│     NestJS Core Backend (API)        │
│  /api/v1/core                       │
│                                     │
│  Auth, Organizations, Units, Staff  │
│  Schedules, Jobs, Preferences       │
│  Messages, Webhook, Audit Logs      │
└────────────┬────────────────────────┘
             │
     ┌───────┴──────────┐
     │                  │
     ▼                  ▼
PostgreSQL DB     Python Solver
(TypeORM)         (OR-Tools CLI)
                       │
             ┌─────────┴─────────┐
             │ (optional cloud)  │
             ▼                   ▼
           AWS S3          AWS Step Functions
        (artifacts)        (job orchestration)
```

### Request Path

1. Browser → Next.js BFF API route
2. BFF attaches `Authorization: Bearer <token>` and proxies to NestJS backend
3. NestJS validates JWT, resolves org/unit context from token payload
4. Controller delegates to service layer
5. Service reads/writes PostgreSQL via TypeORM entities
6. For scheduling: service enqueues a solver job → runner normalizes data → calls Python solver → stores results

---

## 2. Domain Model & Business Logic

### Organizational Hierarchy

```
Organization
  └── Site (hospital campus)
        └── Unit (ward / department)
              ├── ShiftTemplates (e.g. Morning 07:00–15:00)
              ├── ConstraintProfile (active solver rules)
              ├── CoverageRules (required staffing levels)
              └── Workers (nurses assigned to unit)
```

- One **Organization** contains many **Sites**.
- One **Site** contains many **Units** (wards).
- Each **Unit** has its own solver configuration: shift templates, one active constraint profile, and coverage rules.

### Workers vs Users

The system separates two concerns:

| Concept | Entity | Purpose |
|---|---|---|
| **User** | `users` | Web account with email/password for login |
| **Worker** | `workers` | Nurse profile used in scheduling (workerCode, employment type) |

A nurse typically has both. A manager may have only a `User`. These are linked via `worker.userId`. The `unit_memberships` table maps users to units with a role; `worker_unit_memberships` maps worker profiles to units.

### Roles

There are four system roles embedded in JWT payloads:

| Role Code | Description |
|---|---|
| `ADMIN` | System-wide administrator (can access all orgs) |
| `ORG_ADMIN` | Organization administrator |
| `UNIT_MANAGER` | Manages one or more units |
| `NURSE` | Nursing staff member |

Roles are scoped at two levels:
- **Global** (`user_roles` table) — affects cross-org access
- **Unit-scoped** (`unit_memberships.role_code`) — embedded in JWT `unitIds` array

### Employment Types

Workers have an `employmentType`: `FULL_TIME`, `PART_TIME`, `CONTRACT`. This affects overtime eligibility and scheduling weight.

### Shift Templates

Each unit defines its own shift codes. Common conventions:

| Code | Name | Typical Hours |
|---|---|---|
| `M` | Morning | 07:00–15:00 |
| `A` | Afternoon/Evening | 15:00–23:00 |
| `N` | Night | 23:00–07:00 |

The solver references shift templates by `code`. Coverage rules and preferences use the same codes.

### Constraint Profiles

A constraint profile is the complete set of rules the solver enforces. Only **one profile can be active per unit** at a time. Key fields:

| Field | Type | Effect |
|---|---|---|
| `forbidNightToMorning` | bool | Bans Night shift followed by Morning next day (HARD) |
| `forbidEveningToNight` | bool | Bans Evening followed by Night same day (HARD) |
| `maxNightsPerWeek` | int | Cap on nightly assignments per nurse per week |
| `minDaysOffPerWeek` | int | Minimum rest days per nurse per week |
| `maxShiftsPerDay` | int | Normally 1; overtime overrides via post-fill |
| `guaranteeFullCoverage` | bool | Forces overtime/backfill when demand cannot be met |
| `allowEmergencyOverrides` | bool | Enables escalating backfill levels (see Solver section) |
| `ignoreAvailabilityInEmergency` | bool | Level 3 backfill ignores availability |

### Coverage Rules

Coverage rules specify required staffing per `(shiftCode, dateType)` combination.

| Field | Type | Notes |
|---|---|---|
| `shiftCode` | string | e.g. `"M"`, `"N"` |
| `dateType` | enum | `WEEKDAY`, `WEEKEND`, `HOLIDAY` |
| `minWorkers` | int | Soft minimum (penalty if unmet) |
| `maxWorkers` | int | Hard cap |

---

## 3. Authentication & Authorization

### 2FA Login Flow

```
Client                       Backend
  │                             │
  │  POST /auth/login           │
  │  { email, password }        │
  │ ─────────────────────────► │
  │                             │  1. Validate password (bcrypt)
  │                             │  2. Generate 6-digit OTP
  │                             │  3. Send OTP to user email (MailService)
  │                             │  4. Save OTP hash to auth_otp table (10 min TTL)
  │                             │  5. Sign short-lived "otpToken" JWT
  │ ◄───────────────────────── │
  │  { requires2FA, otpToken }  │
  │                             │
  │  POST /auth/verify-otp      │
  │  { otpToken, otp: "123456" }│
  │ ─────────────────────────► │
  │                             │  1. Verify otpToken JWT
  │                             │  2. Look up pending OTP in auth_otp
  │                             │  3. Compare OTP hash
  │                             │  4. Build context (unitIds, roles, orgId)
  │                             │  5. Sign full accessToken JWT (1 day)
  │ ◄───────────────────────── │
  │  { accessToken, user }      │
```

Development without SMTP: OTP is printed to server console.

### JWT Payload Structure

```json
{
  "sub": "42",
  "email": "user@example.com",
  "fullName": "John Doe",
  "organizationId": 1,
  "roles": ["NURSE"],
  "unitIds": [2, 3],
  "iat": 1700000000,
  "exp": 1700086400
}
```

`roles` comes from global `user_roles`. `unitIds` comes from `unit_memberships` (the units the user belongs to).

### Guards

- `JwtAuthGuard` — validates Bearer token on all protected routes
- `RolesGuard` — enforces `@Roles(...)` decorator; checks `req.user.roles`

---

## 4. Schedule Lifecycle

### Status States

```
DRAFT ──► PUBLISHED ──► ARCHIVED
```

- `DRAFT` — schedule container created, no solver run yet
- `PUBLISHED` — solver output applied and persisted as assignments
- `ARCHIVED` — historical, read-only

### Full Flow

```
1. POST /units/:unitId/schedules
   → Creates Schedule (status=DRAFT, no assignments yet)

2. POST /schedules/:scheduleId/jobs
   → Creates ScheduleJob (state=REQUESTED)
   → Enqueues in local runner or Step Functions

3. Runner: REQUESTED → VALIDATED → NORMALIZING
   → NormalizerService builds NormalizedInput.v1 JSON

4. Runner: NORMALIZING → SOLVING
   → SolverAdapter spawns Python process
   → OR-Tools CP-SAT runs constraint program

5. Runner: SOLVING → SOLVED
   → Solver returns SolveResponse JSON
   → Artifacts stored to S3 (if configured)
   → ScheduleAssignments populated (solver draft, not yet active)

6. GET /jobs/:jobId/preview
   → Manager reviews assignments before committing

7. POST /jobs/:jobId/apply
   → Assignments written to schedule_assignments table
   → Schedule status → PUBLISHED

8. PATCH /schedule-assignments/:id
   → Manager manual override on any individual assignment
```

---

## 5. Job Orchestration Workflow

### Job State Machine

```
REQUESTED
    │
    ▼
VALIDATED ──────────────────────────────── FAILED
    │
    ▼
NORMALIZING ────────────────────────────── FAILED
    │
    ▼
SOLVING_A_STRICT ───────────────────────── FAILED
    │ (or RELAXED / MILP fallback)
    ▼
SOLVED
    │
    ▼
APPLYING
    │
    ▼
COMPLETED ──────────────────────────────── FAILED
```

### Local Runner (`ORCHESTRATION_MODE=LOCAL_RUNNER`)

The `JobsRunnerService` maintains an in-memory queue. When a job is enqueued:

1. `enqueue(jobId)` — pushes to queue, kicks off async processing loop
2. `run(jobId)` steps through all phases:
   - Transitions job state in DB at each step
   - Calls `NormalizerService.normalize(scheduleId)` → `NormalizedInput.v1`
   - Writes normalized input to S3 artifact (if bucket configured)
   - Calls `SolverAdapter.solve(normalizedInput)` → `SolveResponse`
   - Writes solver output artifact to S3
   - If `MAYWIN_AUTO_PERSIST_SCHEDULES=true`, automatically applies results

Each step records a `ScheduleJobEvent` for audit trail.

### AWS Step Functions (`ORCHESTRATION_MODE=STEP_FUNCTIONS`)

When Step Functions mode is active:

1. `POST /orchestrator/run` calls `StartExecution` on the state machine ARN
2. Step Functions triggers the Python Lambda (`src/aws/solver_lambda/app.py`)
3. Lambda fetches normalized input from S3, calls solver, writes output to S3
4. Step Functions notifies the NestJS backend via callback or polling

Required env vars:
```
AWS_REGION=ap-southeast-1
SCHEDULE_WORKFLOW_ARN=arn:aws:states:...
MAYWIN_ARTIFACTS_BUCKET=your-bucket
```

### Idempotency

Jobs support `Idempotency-Key` header. If a job for the same `(scheduleId, idempotencyKey)` already exists, the existing job is returned instead of creating a duplicate.

---

## 6. Solver Architecture

### Overview

The solver is a standalone Python program (`src/aws/solver_lambda/solver_cli.py`) using Google OR-Tools CP-SAT (Constraint Programming - Satisfiability). It runs as a subprocess spawned by the NestJS `SolverAdapter`.

```
NestJS (SolverAdapter)
    │
    │  spawn process
    │  python solver_cli.py --cli --input in.json --output out.json
    ▼
Python Solver (OR-Tools CP-SAT)
    │
    │  reads SolveRequest JSON
    │  builds CP-SAT model
    │  runs solver (time-limited)
    │  writes SolveResponse JSON
    ▼
NestJS reads out.json
```

### Solver Input: `SolveRequest`

```json
{
  "nurses": ["N001", "N002", "N003"],
  "days": ["2026-03-01", "2026-03-02", "..."],
  "shifts": ["M", "A", "N"],
  "demand": {
    "2026-03-01": { "M": 3, "A": 2, "N": 2 },
    "...": {}
  },
  "availability": {
    "N001": {
      "2026-03-01": { "M": true, "A": true, "N": false }
    }
  },
  "preferences": {
    "N001": {
      "2026-03-01": { "M": 9, "A": 5 }
    }
  },
  "constraints": {
    "forbid_night_to_morning": true,
    "forbid_evening_to_night": false,
    "max_nights_per_week": 2,
    "min_days_off_per_week": 2,
    "per_nurse_max_ot": 3
  },
  "time_limit_seconds": 60
}
```

### CP-SAT Model

**Decision variables:**

```
x[(nurse, day, shift)] ∈ {0, 1}
```

**Hard constraints (always enforced):**

1. **One shift per day** — `∑ x[(n, d, s)] ≤ 1` for all (n, d)
2. **No Night → Morning** (if `forbid_night_to_morning=true`) — if `x[(n, d, N)]=1` then `x[(n, d+1, M)]=0`
3. **No Evening → Night** (if `forbid_evening_to_night=true`) — if `x[(n, d, A)]=1` then `x[(n, d, N)]=0`
4. **Max nights per week** — `∑ x[(n, week, N)] ≤ max_nights_per_week`
5. **Min days off per week** — `∑ x[(n, week, *)] ≤ 7 - min_days_off_per_week`
6. **Availability** — `x[(n, d, s)] = 0` if `availability[n][d][s] = false`

**Soft objectives (minimized):**

1. **Understaffing penalty** — `∑ max(0, demand[d][s] - actual[d][s]) × understaff_penalty`
2. **Preference penalty** — `∑ (1 - pref_score) × x[(n, d, s)] × preference_penalty_multiplier`
3. **Overtime penalty** — `∑ overtime_assignments × overtime_penalty`

### Solver Plans

The solver runs up to three escalating plans:

| Plan | Mode | Description |
|---|---|---|
| `A_STRICT` | Strict CP-SAT | All hard constraints active, preferences maximized |
| `A_RELAXED` | Relaxed CP-SAT | Some soft constraints relaxed to improve feasibility |
| `B_MILP` | MILP fallback | Used when CP-SAT cannot find a feasible solution |

The first plan that produces a feasible result is accepted.

### Post-Fill / Overtime Backfill

When the primary solve leaves understaffed shifts, `backfill_missing_with_overtime()` runs escalating levels to fill gaps:

| Level | What's allowed |
|---|---|
| 0 | Regular assignments, respects availability, one shift/day |
| 1 | Second shift same day (overtime), respects availability |
| 2 | Second shift + weekly night cap overflow |
| 3 | Ignore availability entirely (emergency coverage) |

Level 3 is only reached if `ignoreAvailabilityInEmergency=true` in the constraint profile.

Assignments created by backfill are marked `is_overtime=true` and `shift_order=2`.

### Solver Output: `SolveResponse`

```json
{
  "status": "OPTIMAL",
  "objective_value": 1234,
  "assignments": [
    { "day": "2026-03-01", "shift": "M", "nurse": "N001", "shift_order": 1, "is_overtime": false },
    { "day": "2026-03-01", "shift": "M", "nurse": "N003", "shift_order": 2, "is_overtime": true }
  ],
  "understaffed": [
    { "day": "2026-03-15", "shift": "N", "needed": 2, "assigned": 1 }
  ],
  "nurse_stats": {
    "N001": {
      "assigned_shifts": 22,
      "overtime": 1,
      "nights": 4,
      "satisfaction": 0.84
    }
  }
}
```

`status` values: `OPTIMAL`, `FEASIBLE`, `RELAXED_OPTIMAL`, `HEURISTIC`, `INFEASIBLE`, `ERROR`

### SolverAdapter (NestJS → Python Bridge)

`src/core/solver/solver.adapter.ts`:

1. Detects `NormalizedInput.v1` format and converts to `SolveRequest`
2. Writes `in.json` to `/tmp`
3. Spawns: `${SOLVER_PYTHON} ${SOLVER_CLI_PATH} --cli --input in.json --output out.json`
4. Waits for process exit (timeout: `timeLimitSeconds + 30s` buffer)
5. Reads and parses `out.json`
6. Returns `SolveResponse`

**Environment variables:**

| Variable | Default | Notes |
|---|---|---|
| `SOLVER_PYTHON` | `py` (Windows) / `python3` (Unix) | Path to Python executable |
| `SOLVER_CLI_PATH` | `src/aws/solver_lambda/solver_cli.py` | Path to solver script |

---

## 7. Normalizer Service

`src/core/normalizer/normalizer.service.ts` transforms database records into the `NormalizedInput.v1` JSON consumed by the solver.

### Steps

1. Load `Schedule` → extract `startDate`, `endDate`, `unitId`, `constraintProfileId`
2. Load active `ShiftTemplates` for the unit → build `shifts[]`
3. Load `CoverageRules` → build `demand[date][shift]` (expand date-type rules to specific dates)
4. Load `WorkerUnit` memberships → build `nurses[]` list
5. Load `WorkerAvailability` → build `availability[nurse][date][shift]`
6. Load `WorkerPreferences` → build `preferences[nurse][date][shift]`
7. Load active `ConstraintProfile` → extract constraint fields
8. Return `NormalizedInput.v1` JSON

### NormalizedInput.v1 Schema

```json
{
  "schema": "NormalizedInput.v1",
  "scheduleId": "42",
  "unitId": "2",
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "nurses": [
    { "code": "N001", "workerId": "69", "employmentType": "FULL_TIME" }
  ],
  "shifts": ["M", "A", "N"],
  "demand": { "2026-03-01": { "M": 3, "A": 2, "N": 2 } },
  "availability": { "N001": { "2026-03-01": { "M": true, "A": true, "N": false } } },
  "preferences": { "N001": { "2026-03-01": { "M": 9 } } },
  "constraints": {
    "forbid_night_to_morning": true,
    "max_nights_per_week": 2,
    "min_days_off_per_week": 2,
    "per_nurse_max_ot": 3
  }
}
```

---

## 8. Worker Messaging & LINE Chatbot

### Message Model

`worker_messages` table:

| Field | Type | Notes |
|---|---|---|
| `workerId` | FK | The nurse this message belongs to |
| `unitId` | FK | Unit context |
| `jobId` | FK (nullable) | Linked solver job |
| `direction` | enum | `INBOUND` (from nurse) / `OUTBOUND` (to nurse) |
| `status` | enum | `SENT`, `DELIVERED`, `READ`, `ARCHIVED` |
| `subject` | string | Optional subject |
| `body` | text | Message content |
| `attributes` | JSON | Arbitrary metadata (shift requests, chatbot state, etc.) |

### LINE Chatbot Integration

The `WebhookModule` handles inbound messages from nurses via LINE Messaging API.

**Flow:**

```
Nurse (LINE app)
    │
    │  POST /webhook  (LINE webhook event)
    ▼
WebhookController
    │  Verifies X-Line-Signature
    ▼
WebhookService
    │  1. Look up worker by LINE user ID (via line_link_tokens)
    │  2. Parse message intent (shift preferences, day-off requests)
    │  3. Update WorkerPreferences in DB
    │  4. Create WorkerMessage record (INBOUND)
    │  5. Save/update chatbot_conversations state
    │  6. Reply to nurse via LINE Messaging API
    ▼
LINE API → Nurse phone
```

**Linking a nurse's LINE account:**

1. Manager calls `POST /staff/:id/link-token` → gets one-time token
2. Manager sends token to nurse (out-of-band)
3. Nurse sends token as first LINE message
4. Backend looks up `line_link_tokens`, links LINE user ID to `worker.lineUserId`

---

## 9. Database Schema

Schema: `maywin_db` (PostgreSQL)

### Entity Map

#### Core

| Table | Entity | Notes |
|---|---|---|
| `organizations` | Organization | Top-level tenant |
| `sites` | Site | Hospital campus within org |
| `units` | Unit | Ward within site |
| `roles` | Role | Static role definitions |

#### Users

| Table | Entity | Notes |
|---|---|---|
| `users` | User | Web accounts |
| `user_roles` | UserRole | Global role assignments |
| `unit_memberships` | UnitMembership | User → unit mapping + role |
| `auth_otp` | AuthOtp | Pending OTP codes (10 min TTL) |

#### Workers

| Table | Entity | Notes |
|---|---|---|
| `workers` | Worker | Nurse profiles |
| `worker_unit_memberships` | WorkerUnit | Worker → unit mapping |
| `worker_availability` | WorkerAvailability | Availability per date/shift |
| `worker_preferences` | WorkerPreferences | Shift preferences JSON |
| `worker_messages` | WorkerMessage | Inbox messages |
| `chatbot_conversations` | ChatbotConversation | LINE chatbot state |
| `line_link_tokens` | LineLinkToken | One-time LINE invite tokens |

#### Scheduling

| Table | Entity | Notes |
|---|---|---|
| `schedules` | Schedule | Schedule container (per unit + period) |
| `schedule_runs` | ScheduleRun | Specific solver execution |
| `schedule_assignments` | ScheduleAssignment | Individual nurse-shift assignments |
| `shift_templates` | ShiftTemplate | Shift definitions per unit |
| `constraint_profiles` | ConstraintProfile | Solver constraint sets |
| `coverage_rules` | CoverageRule | Staffing demand rules |

#### Orchestration

| Table | Entity | Notes |
|---|---|---|
| `schedule_jobs` | ScheduleJob | Solver job requests |
| `schedule_job_events` | ScheduleJobEvent | Event log per job |
| `schedule_artifacts` | ScheduleArtifact | S3 artifact pointers |
| `solver_runs` | SolverRun | Solver execution metadata |
| `solver_run_assignments` | SolverRunAssignment | Raw solver output rows |

### Key Relationships

```
Organization ─┬─ Site ─── Unit ─┬─ ShiftTemplate
               │                 ├─ ConstraintProfile
               │                 ├─ CoverageRule
               │                 ├─ Schedule ─── ScheduleAssignment
               │                 └─ Worker ─────┬─ WorkerAvailability
               │                                ├─ WorkerPreferences
               │                                └─ WorkerMessage
               └─ User ─── UnitMembership
```

### ScheduleAssignment Key Fields

```sql
schedule_assignments (
  id            UUID PK,
  schedule_id   FK → schedules,
  worker_id     FK → workers,
  date          DATE,
  shift_code    VARCHAR,
  shift_order   INT DEFAULT 1,   -- 1=primary, 2=overtime
  is_overtime   BOOLEAN DEFAULT false,
  is_manual     BOOLEAN DEFAULT false,  -- true if manager override
  created_at    TIMESTAMP,
  updated_at    TIMESTAMP
)
```

---

## 10. Configuration Reference

All configuration via environment variables. See `.env.development` for defaults.

### Required

| Variable | Example | Notes |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | |
| `DB_PASSWORD` | `maywin12345` | |
| `DB_NAME` | `maywin` | Database name |
| `DB_SCHEMA` | `maywin_db` | Schema name |
| `JWT_SECRET` | `change-me-32chars+` | Min 32 chars for production |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `PORT` | `3000` | HTTP listen port |

### Solver

| Variable | Default | Notes |
|---|---|---|
| `SOLVER_PYTHON` | `py` (Windows) / `python3` (Unix) | Python executable |
| `SOLVER_CLI_PATH` | `src/aws/solver_lambda/solver_cli.py` | Solver script path |
| `ENQUEUE_LOCAL_RUNNER` | `true` | Auto-enqueue jobs in local runner |

### Orchestration

| Variable | Default | Notes |
|---|---|---|
| `ORCHESTRATION_MODE` | `LOCAL_RUNNER` | `LOCAL_RUNNER` or `STEP_FUNCTIONS` |
| `MAYWIN_ORCHESTRATION_MODE` | — | Alias for `ORCHESTRATION_MODE` |
| `MAYWIN_AUTO_PERSIST_SCHEDULES` | `false` | Auto-apply solver output |

### AWS (optional)

| Variable | Example | Notes |
|---|---|---|
| `AWS_REGION` | `ap-southeast-1` | |
| `MAYWIN_ARTIFACTS_BUCKET` | `maywin-artifacts` | S3 bucket |
| `MAYWIN_ARTIFACTS_PREFIX` | `maywin/core` | S3 key prefix |
| `SCHEDULE_WORKFLOW_ARN` | `arn:aws:states:...` | Step Functions ARN |
| `MAYWIN_SFN_ARN` | — | Alias for `SCHEDULE_WORKFLOW_ARN` |

### LINE Chatbot (optional)

| Variable | Notes |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API token |
| `LINE_CHANNEL_SECRET` | Used to verify webhook signatures |

### AI (optional)

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` | Gemini API key for chatbot AI responses |

### Audit Logging

| Variable | Default | Notes |
|---|---|---|
| `AUDIT_LOG_DIR` | `/tmp` | Directory for local CSV audit log |

---

## 11. Deployment & Infrastructure

### Docker Images

Three Dockerfiles are provided:

| File | Purpose | Base |
|---|---|---|
| `Dockerfile` | Main NestJS API | `node:20-alpine` (multi-stage) |
| `Dockerfile.lambda` | Python solver Lambda | `python:3.12-slim` |
| `Dockerfile.lambda-http` | HTTP wrapper for Lambda | Thin HTTP layer on solver |

#### `Dockerfile` (NestJS API) — Build Stages

```
Stage 1 (builder):
  - node:20-alpine
  - COPY package*.json
  - npm ci --only=production
  - COPY src/ tsconfig*
  - npm run build → dist/

Stage 2 (runner):
  - node:20-alpine
  - COPY --from=builder dist/ node_modules/
  - ENV NODE_ENV=production
  - CMD ["node", "dist/main.js"]
```

### Docker Compose (Development)

`docker-compose.yml` defines two services:

```yaml
services:
  db:
    image: postgres:16-alpine
    ports: ["5433:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: maywin
      POSTGRES_PASSWORD: maywin12345

  app:
    build: .
    ports: ["3000:3000"]
    depends_on: [db]
    env_file: .env
```

### AWS Lambda Deployment

The solver is packaged as an AWS Lambda function for Step Functions integration:

1. Build Docker image from `Dockerfile.lambda`
2. Push to Amazon ECR
3. Update Lambda function code: `aws lambda update-function-code --image-uri <ecr-uri>`
4. Lambda handler: `app.handler` in `src/aws/solver_lambda/app.py`

**Lambda input/output:**

```json
// Input (from Step Functions)
{
  "jobId": "job-uuid",
  "scheduleId": "42",
  "normalizedArtifact": { "bucket": "...", "key": "..." },
  "timeLimitSeconds": 60
}

// Output
{
  "status": "COMPLETED",
  "jobId": "job-uuid",
  "solverArtifact": { "bucket": "...", "key": "...", "sha256": "...", "bytes": 12345 },
  "solver": { "feasible": true, "objective": 1234 }
}
```

### S3 Artifact Storage

When `MAYWIN_ARTIFACTS_BUCKET` is set, the following artifacts are stored to S3:

| Artifact Type | Key Pattern | Contents |
|---|---|---|
| `NORMALIZED_INPUT` | `{prefix}/{jobId}/normalized-input.json` | `NormalizedInput.v1` |
| `SOLVER_OUTPUT` | `{prefix}/{jobId}/solver-output.json` | `SolveResponse` |
| `SOLVER_KPI` | `{prefix}/{jobId}/kpis.json` | Per-nurse statistics |
| `SCHEDULE_EXPORT` | `{prefix}/{scheduleId}/export.csv` | Exported schedule |

`S3ArtifactsService` handles all S3 operations. Without S3, artifacts are stored in the `schedule_artifacts` table as inline JSON.

### Production Checklist

- [ ] Set strong `JWT_SECRET` (min 32 chars, random)
- [ ] Set `PGSSLMODE=require` for encrypted DB connections
- [ ] Disable TypeORM `logging` or set to `["error"]` only
- [ ] Never use `synchronize: true` — use migrations
- [ ] Set `ORCHESTRATION_MODE=STEP_FUNCTIONS` for production solver runs
- [ ] Configure `MAYWIN_ARTIFACTS_BUCKET` for durable artifact storage
- [ ] Use IAM roles for Lambda/Step Functions (not hardcoded AWS credentials)
- [ ] Set `NODE_ENV=production`

---

## 12. DevOps & Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Python 3.10+ with pip

### Initial Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Install Python solver dependencies
cd src/aws/solver_lambda
python -m venv .venv

# Windows:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cd ../../..

# 3. Configure environment
cp .env.development .env
# Edit .env with your DB credentials

# 4. Provision database
npm run migration:run
# or: psql -U postgres -d maywin -f src/database/schema/maywin_schema.sql

# 5. Run development server (watch mode)
npm run dev
```

### Available npm Scripts

| Script | Command | Notes |
|---|---|---|
| `dev` | `nest start --watch` | Development with hot-reload |
| `start` | `node dist/main.js` | Production start (needs `build` first) |
| `build` | `nest build` | Compile TypeScript → `dist/` |
| `migration:run` | `typeorm migration:run -d src/database/data-source.ts` | Apply migrations |
| `migration:revert` | `typeorm migration:revert` | Revert last migration |
| `migration:generate` | `typeorm migration:generate` | Generate new migration from entity diffs |

### Running with Docker

```bash
# Start full stack (DB + API)
docker compose up --build

# Stop
docker compose down

# Reset DB volume
docker compose down -v
```

### Testing the Solver Locally

```bash
# Run solver directly against a JSON input
cd src/aws/solver_lambda
python solver_cli.py --cli --input example-request.json --output out.json
cat out.json

# Start solver as HTTP API (optional, for direct testing)
uvicorn solver_cli:app --reload --port 8001
# POST http://localhost:8001/solve
```

### Database Migrations

Migrations are in `src/database/migrations/`. TypeORM uses `src/database/data-source.ts` as the connection config.

```bash
# Apply all pending migrations
npm run migration:run

# Generate migration from entity changes
npx typeorm migration:generate src/database/migrations/MyMigration -d src/database/data-source.ts

# Revert last migration
npm run migration:revert
```

**Never use `synchronize: true` in production.**

### Seeding Test Data

Seed scripts are in `src/database/seeds/`:

```bash
# Run a seed script
npx ts-node src/database/seeds/seed-from-json.ts
```

### Health Check

```bash
curl http://localhost:3000/api/v1/core/health
# { "status": "ok" }
```

### Logs

The app logs to stdout. In development, TypeORM SQL queries are logged. To reduce noise in production, set `logging: ["error"]` in `src/database/typeorm.config.ts`.

### Environment Files

| File | Purpose |
|---|---|
| `.env` | Active config (gitignored for production) |
| `.env.development` | Development defaults |
| `.env.production` | Production secrets — **never commit to git** |

### Module Import Aliases

The project uses `module-alias` for clean imports:

```typescript
import { Something } from '@/core/something';
// resolves to src/core/something
```

Configured in `package.json` under `_moduleAliases`.
