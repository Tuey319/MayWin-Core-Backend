# MayWin Nurse Scheduling Platform – Core Backend

Backend service for nurse scheduling built with NestJS and PostgreSQL. It manages organizations, sites, units, workers, availability, preferences, messages, and runs a Python OR‑Tools–based optimizer to generate schedules. Optional AWS integration supports job orchestration and artifact storage.

---

## Tech stack

- **Runtime**: Node.js (NestJS 11, TypeScript)
- **Database**: PostgreSQL (schema `maywin_db`)
- **ORM**: TypeORM
- **Auth**: JWT (Bearer tokens)
- **Solver**: Python 3 + OR‑Tools + FastAPI (`src/core/solver/solver_cli.py`)
- **Cloud (optional)**:
  - AWS S3 for schedule/solver artifacts (`S3ArtifactsService`)
  - AWS Step Functions for schedule job orchestration (`OrchestratorModule`)

All HTTP routes are mounted under:

- `http://<host>:<port>/api/v1/core/*`

---

## Features

- JWT authentication (`/auth/login`, `/auth/me`) with unit‑ and role‑aware payloads.
- Organizations, sites, units, workers as core domain entities.
- Worker availability and preferences over a date range.
- Unit configuration: shift templates, coverage rules, constraint profiles.
- Schedule lifecycle per unit + horizon:
  - create schedule containers
  - enqueue async solver jobs
  - preview solver output
  - apply solver output to persisted schedules
  - manually edit individual schedule assignments
- **Worker messaging**:
  - inbox‑style messages scoped to workers, units, and jobs
  - filters by unit, job, direction (`INBOUND`/`OUTBOUND`), status (`SENT`/`DELIVERED`/`READ`/`ARCHIVED`)
- **Job orchestration**:
  - local runner mode for solver jobs
  - optional AWS Step Functions mode for schedule workflows
  - optional S3 storage for artifacts (normalized input, solver output, KPIs, etc.)
- OR‑Tools–based solver with strict/relaxed/MILP fallback plans and KPIs.

---

## Getting started

### 1. Prerequisites

- Node.js **18+** and npm
- PostgreSQL **13+**
- Python **3.10+** (for the solver) with `pip`

### 2. Install Node dependencies

```bash
npm install
```

### 3. Install Python solver dependencies

From the project root:

```bash
cd src/core/solver
python -m venv .venv
```

On Windows PowerShell:

```bash
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

(Use the equivalent virtualenv activation command on macOS/Linux.)

### 4. Configure environment

Create a `.env` file in the project root (change all secrets for real deployments).

**Core backend & database:**

```bash
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=maywin12345
DB_NAME=maywin
DB_SCHEMA=maywin_db

# JWT
JWT_SECRET=change-me

# Python solver integration
SOLVER_PYTHON=python3        # or "py" on Windows
SOLVER_CLI_PATH=src/core/solver/solver_cli.py
```

**Optional: AWS / orchestration / artifacts:**

```bash
# Region for S3 + Step Functions
AWS_REGION=ap-southeast-1

# S3 bucket + prefix to store solver/schedule artifacts
MAYWIN_ARTIFACTS_BUCKET=your-bucket-name
MAYWIN_ARTIFACTS_PREFIX=maywin-artifacts/core   # optional

# Orchestration mode: LOCAL_RUNNER (default) or STEP_FUNCTIONS
ORCHESTRATION_MODE=LOCAL_RUNNER
# or MAYWIN_ORCHESTRATION_MODE=STEP_FUNCTIONS

# Step Functions state machine ARN for schedule workflows
SCHEDULE_WORKFLOW_ARN=arn:aws:states:...
# or MAYWIN_SFN_ARN=arn:aws:states:...
```

- If `ORCHESTRATION_MODE`/`MAYWIN_ORCHESTRATION_MODE` is not set, the app defaults to **LOCAL_RUNNER** (no Step Functions).
- S3 artifact storage is only used if `MAYWIN_ARTIFACTS_BUCKET` is configured.

The backend reads DB settings from `src/database/typeorm.config.ts` and JWT settings from `AuthModule`.

### 5. Provision the database

Create an empty PostgreSQL database (matching `DB_NAME`) and apply the schema:

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f src/database/schema/maywin_schema.sql
```

Alternatively, run TypeORM migrations (once configured):

```bash
# Uses src/database/data-source.ts
yarn typeorm migration:run
# or
npm run migration:run
```

> The application expects the tables, enums and schema created by `src/database/schema/maywin_schema.sql`.

### 6. Run the backend

From the project root:

```bash
# Watch mode (development)
npm run dev

# One-off start (no watch)
npm run start
```

The service exposes:

- `http://localhost:${PORT}/api/v1/core`
- Default: `http://localhost:3000/api/v1/core`

Health check:

```bash
curl http://localhost:3000/api/v1/core/health
```

You should see a JSON response with status `ok`.

---

## Python solver integration

By default the NestJS backend calls the solver via a Python CLI process using `SolverAdapter` (not HTTP):

- CLI entrypoint: `src/core/solver/solver_cli.py`
- Adapter: `src/core/solver/solver.adapter.ts`

Flow:

1. Normalize scheduling data via `NormalizerService`.
2. Write a temporary JSON file in the Python `SolveRequest` format.
3. Run `SOLVER_PYTHON SOLVER_CLI_PATH --cli --input <in.json> --output <out.json>`.
4. Read `SolveResponse` JSON and map it to assignments, KPIs, etc.

Run the solver manually in CLI mode (for debugging):

```bash
cd src/core/solver
python solver_cli.py --cli --input example-request.json --output out.json
```

`example-request.json` must match the `SolveRequest` shape expected by `solver_cli.py`.

Expose the solver as an HTTP API (optional):

```bash
cd src/core/solver
uvicorn src.core.solver.solver_cli:app --reload --port 8001
```

---

## High-level architecture

### Modules

- `AuthModule` – login and JWT (`/auth/login`, `/auth/me`).
- `DatabaseModule` – TypeORM configuration and entity registration.
- `HealthModule` – health check endpoint (`/health`).
- `WorkersModule` – list workers per unit.
- `AvailabilityModule` – worker availability per unit & date range.
- `WorkerPreferencesModule` – per‑worker, per‑unit preferences.
- `UnitConfigModule` (+ submodules) – shift templates, coverage rules, constraint profiles.
- `ShiftTemplatesModule` – shift templates per unit.
- `ConstraintProfilesModule` – constraint profiles per unit.
- `CoverageRulesModule` – coverage rules per unit.
- `SchedulesModule` – schedule containers and exports.
- `JobsModule` – orchestration of async solver runs and artifacts.
- `NormalizerModule` – builds `NormalizedInput.v1` payload for the solver.
- `SolverModule` – `SolverAdapter` integration with the Python solver.
- `OrganizationsModule` – organization metadata for the authenticated user and org admin.
- `SitesModule` – per‑organization sites (e.g. hospital campuses).
- `UnitsModule` – per‑site units/wards and unit metadata.
- `RolesModule` – static roles list used in auth/permissions.
- **`WorkerMessagesModule`** – worker/unit/job messages ("nurse inbox", manager views).
- **`BucketsModule`** – S3 artifact storage service (`S3ArtifactsService`).
- **`OrchestratorModule`** – orchestration entrypoint that can run locally or via AWS Step Functions.

### Database

- Schema file: `src/database/schema/maywin_schema.sql` (creates schema `maywin_db`).
- Entities live in `src/database/entities/*` and are registered in `DatabaseModule`.
- Orchestration tables track schedule jobs, solver runs and artifacts.
- **Messages**:
  - `worker_messages` table (`WorkerMessage` entity) indexed by worker, unit, job, and time.
  - Fields for direction, status, subject, body, optional job/schedule/shift metadata, and arbitrary JSON `attributes`.

---

## API overview

All paths below are relative to `/api/v1/core` and require a valid Bearer token unless noted.

### Auth

- `POST /auth/login`
  - Logins with the JWT payload attached to `req.user`.
- `GET /auth/me`
  - Returns the JWT payload attached to `req.user`.

### Health

- `GET /health` – public health check (no auth by default).

### Organizations

- `GET /organizations/me` – organization for the authenticated user.
- `POST /organizations` – create an organization (bootstrap/admin use).
- `PATCH /organizations/:orgId` – update an organization, scoped to `req.user.organizationId`.

### Sites

- `GET /sites` – list sites for the current organization (see `ListSitesQueryDto`).
- `POST /sites` – create a new site.
- `POST /sites/:siteId/deactivate` – soft‑deactivate a site.

### Units & workers

- `GET /units` – list units for the current organization/site (see `ListUnitsQueryDto`).
- `GET /units/:unitId` – single unit with metadata, scoped to the user’s organization/units.
- `POST /units` – create a unit.
- `PATCH /units/:unitId` – update unit metadata.
- `POST /units/:unitId/deactivate` – soft‑deactivate a unit.
- `GET /units/:unitId/workers` – list workers in a unit (searchable via `?search=`).

### Roles

- `GET /roles` – list roles used in auth/permissions.

### Unit configuration

- `GET /units/:unitId/config` – one‑shot configuration payload for the scheduling UI.

- `GET /units/:unitId/shift-templates` – list active shift templates.
- `POST /units/:unitId/shift-templates` – create a shift template.
- `PATCH /units/:unitId/shift-templates/:id` – update a shift template.
- `DELETE /units/:unitId/shift-templates/:id` – soft‑delete a shift template.

- `GET /units/:unitId/constraint-profiles` – list constraint profiles.
- `POST /units/:unitId/constraint-profiles` – create a profile.
- `PATCH /units/:unitId/constraint-profiles/:id` – update a profile.
- `POST /units/:unitId/constraint-profiles/:id/activate?deactivateOthers=true|false` – activate a profile.

- `GET /units/:unitId/coverage-rules` – list coverage rules.
- `POST /units/:unitId/coverage-rules` – create a rule.
- `PATCH /units/:unitId/coverage-rules/:id` – update a rule.
- `DELETE /units/:unitId/coverage-rules/:id` – remove a rule.
- `PUT /units/:unitId/coverage-rules` – bulk replace rules.

### Availability & worker preferences

- `GET /units/:unitId/availability?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` – fetch availability entries.
- `PUT /units/:unitId/availability` – bulk upsert entries.

- `GET /workers/:workerId/preferences` – fetch stored preferences.
- `PUT /workers/:workerId/preferences` – upsert preferences for a worker and unit.

### Scheduling & jobs

- `POST /units/:unitId/schedules` – create a schedule container for a date horizon.
- `GET /units/:unitId/schedules/current?dateFrom&dateTo` – current schedule + assignments.
- `GET /units/:unitId/schedules/history?limit=` – list past schedules.
- `GET /schedules/:scheduleId` – schedule detail.
- `GET /schedules/:scheduleId/export?format=pdf|csv` – export schedule (often returns a stub or signed URL).

- `PATCH /schedule-assignments/:assignmentId` – manually override a single assignment.

- `POST /schedules/:scheduleId/jobs` – enqueue a solver job (supports `Idempotency-Key` header).
- `GET /jobs/:jobId` – poll job status and phase.
- `GET /jobs/:jobId/artifacts` – list job artifacts (normalized input, solver output, KPIs, etc.).
- `GET /jobs/:jobId/preview` – preview solver output (read‑only).
- `POST /jobs/:jobId/apply` – persist solver output into the schedule (`overwriteManualChanges` flag).
- `POST /jobs/:jobId/cancel` – cancel an in‑progress job.

### Messages

All message endpoints are guarded by `JwtAuthGuard`.

- `POST /workers/:workerId/messages` – create a message for a worker
- `GET /workers/:workerId/messages` – list messages for a worker
- `GET /units/:unitId/messages` – “manager inbox” view of messages in a unit
- `GET /jobs/:jobId/messages` – messages linked to a specific solver job

### Orchestrator

Entry point for running a schedule workflow via the **local runner** or **AWS Step Functions**, depending on environment configuration.

- `POST /orchestrator/run`

## Running with Docker (optional)

A `docker-compose.yml` file is included to run this backend alongside supporting services. It assumes a directory layout with `src/main.ts` and `src/temp` for the database and source code containers.

If your local directory structure matches that compose file, start the stack with:

```bash
docker compose up --build
```

Otherwise, treat `docker-compose.yml` as a reference and adjust paths/services as needed.

---

## Development notes

- Business endpoints are guarded by `JwtAuthGuard` and expect a JWT issued by `/auth/login`.
- Global HTTP prefix is set in `src/main.ts` via `app.setGlobalPrefix('/api/v1/core')`.
- TypeORM logging is enabled by default; adjust in `src/database/typeorm.config.ts` for production.
- Do **not** enable `synchronize: true` on production databases; use migrations and the schema SQL for schema changes.
- Orchestration:
  - `ORCHESTRATION_MODE` / `MAYWIN_ORCHESTRATION_MODE` controls whether `/orchestrator/run` uses the local runner only or also AWS Step Functions.
  - Ensure `AWS_REGION` and `SCHEDULE_WORKFLOW_ARN`/`MAYWIN_SFN_ARN` are set when using Step Functions.
- S3 artifacts:
  - `S3ArtifactsService` writes JSON artifacts to `MAYWIN_ARTIFACTS_BUCKET` under `MAYWIN_ARTIFACTS_PREFIX` (if set).
