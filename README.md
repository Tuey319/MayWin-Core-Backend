# MayWin Nurse Scheduling Platform – Core Backend

NestJS + PostgreSQL backend for nurse scheduling. It manages organizations, units, workers, availability, preferences, messages, and runs an OR‑Tools–based optimization solver (Python) to generate nurse schedules. It also integrates with AWS for job orchestration and artifact storage (optional).

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

All HTTP routes are mounted under the global prefix:

- `http://<host>:<port>/api/v1/core/*`

---

## Features

- Authentication (`/auth/login`, `/auth/me`) with unit‑ and role‑aware JWT payloads.
- Organizations, sites, units and workers (core domain entities).
- Worker availability and preferences for a date range.
- Unit configuration: shift templates, coverage rules, constraint profiles.
- Schedule lifecycle:
  - create schedule containers per unit + horizon
  - request async solver jobs
  - preview solver output
  - apply solver output into persisted schedules
  - manually edit individual schedule assignments
- **Worker messaging**:
  - Inbox-style messages scoped to workers, units, and jobs
  - Filter by unit, job, direction (`INBOUND` / `OUTBOUND`), and status (`SENT`, `DELIVERED`, `READ`, `ARCHIVED`)
- **Job orchestration**:
  - Local runner mode for solver jobs
  - Optional AWS Step Functions mode for orchestrating schedule workflows
  - Optional S3 storage for artifacts (normalized input, solver output, KPIs, etc.)
- OR‑Tools–based solver with strict/relaxed/MILP fallback plans and KPIs

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

Create a `.env` file in the project root based on the values below (change all secrets for real deployments).

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

Create an empty PostgreSQL database (matching `DB_NAME`) and run the schema SQL:

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f src/database/schema/maywin_schema.sql
```

Alternatively, you can use TypeORM migrations (once configured):

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

The service listens on:

- `http://localhost:${PORT}/api/v1/core`
- Default: `http://localhost:3000/api/v1/core`

To verify health:

```bash
curl http://localhost:3000/api/v1/core/health
```

You should see a JSON response with status `ok`.

---

## Python solver integration

The NestJS backend does **not** talk to the solver over HTTP by default; it spawns a Python CLI process using `SolverAdapter`:

- CLI entrypoint: `src/core/solver/solver_cli.py`
- Adapter: `src/core/solver/solver.adapter.ts`

The adapter:

1. Normalizes scheduling data via `NormalizerService`.
2. Writes a temporary JSON file in the Python `SolveRequest` format.
3. Spawns `SOLVER_PYTHON SOLVER_CLI_PATH --cli --input <in.json> --output <out.json>`.
4. Reads `SolveResponse` JSON and maps it to assignments, KPIs, etc.

To run the solver manually in CLI mode for debugging:

```bash
cd src/core/solver
python solver_cli.py --cli --input example-request.json --output out.json
```

(You need to craft `example-request.json` in the `SolveRequest` shape used by `solver_cli.py`.)

If you want to expose the solver as an HTTP API (optional):

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
- `WorkersModule` – listing workers per unit.
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
- **`WorkerMessagesModule`** – worker/unit/job messages (“nurse inbox”, manager views).
- **`BucketsModule`** – S3 artifact storage service (`S3ArtifactsService`).
- **`OrchestratorModule`** – orchestration entrypoint that can run locally or via AWS Step Functions.

### Database

- Schema file: `src/database/schema/maywin_schema.sql` (creates schema `maywin_db`).
- Entities are grouped under `src/database/entities/*` and registered in `DatabaseModule`.
- Orchestration tables track schedule jobs, solver runs and artifacts.
- **Messages**:
  - `worker_messages` table (`WorkerMessage` entity) with indexes by worker, unit and job + time.
  - Fields for direction, status, subject, body, optional job/schedule/shift metadata, and arbitrary JSON `attributes`.

---

## API overview

All paths below are relative to the global prefix `/api/v1/core` and require a valid Bearer token unless noted.

### Auth

- `POST /auth/login`
  - Body: `{ "email": string, "password": string }`
  - Response: `{ accessToken, user: { id, organizationId, roles, unitIds } }`
- `GET /auth/me`
  - Returns the JWT payload attached to `req.user`.

### Health

- `GET /health` – public health check (no auth by default).

### Organizations

- `GET /organizations/me` – fetch the organization linked to the authenticated user.
- `POST /organizations` – create an organization (primarily for bootstrap/admin usage).
- `PATCH /organizations/:orgId` – update an organization, scoped to `req.user.organizationId`.

### Sites

- `GET /sites` – list sites for the current organization (supports query filters via `ListSitesQueryDto`).
- `POST /sites` – create a new site under the current organization.
- `POST /sites/:siteId/deactivate` – soft‑deactivate a site.

### Units & workers

- `GET /units` – list units for the current organization/site context (supports `ListUnitsQueryDto`).
- `GET /units/:unitId` – get a single unit with metadata, scoped to the user’s organization/units.
- `POST /units` – create a unit.
- `PATCH /units/:unitId` – update unit metadata.
- `POST /units/:unitId/deactivate` – soft‑deactivate a unit.
- `GET /units/:unitId/workers` – list workers in a unit (searchable by `?search=`).

### Roles

- `GET /roles` – list available roles used in auth/permissions.

### Unit configuration

- `GET /units/:unitId/config` – one‑shot configuration payload for scheduling UI.
- `GET /units/:unitId/shift-templates` – list active shift templates.
- `POST /units/:unitId/shift-templates` – create a shift template.
- `PATCH /units/:unitId/shift-templates/:id` – update a shift template.
- `DELETE /units/:unitId/shift-templates/:id` – soft‑delete a shift template.

- `GET /units/:unitId/constraint-profiles` – list constraint profiles.
- `POST /units/:unitId/constraint-profiles` – create a profile.
- `PATCH /units/:unitId/constraint-profiles/:id` – update a profile.
- `POST /units/:unitId/constraint-profiles/:id/activate?deactivateOthers=true|false` – activate profile.

- `GET /units/:unitId/coverage-rules` – list coverage rules.
- `POST /units/:unitId/coverage-rules` – create a rule.
- `PATCH /units/:unitId/coverage-rules/:id` – update a rule.
- `DELETE /units/:unitId/coverage-rules/:id` – remove a rule.
- `PUT /units/:unitId/coverage-rules` – bulk replace rules.

### Availability & worker preferences

- `GET /units/:unitId/availability?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` – fetch availability entries.
- `PUT /units/:unitId/availability` – bulk upsert entries.

- `GET /workers/:workerId/preferences` – fetch stored preferences.
- `PUT /workers/:workerId/preferences` – upsert preferences for a worker & unit.

### Scheduling & jobs

- `POST /units/:unitId/schedules` – create a schedule container for a date horizon.
- `GET /units/:unitId/schedules/current?dateFrom&dateTo` – current schedule + assignments.
- `GET /units/:unitId/schedules/history?limit=` – list past schedules.
- `GET /schedules/:scheduleId` – schedule detail.
- `GET /schedules/:scheduleId/export?format=pdf|csv` – export schedule (implementation‑specific; typically returns a stub or a signed URL).

- `PATCH /schedule-assignments/:assignmentId` – manually override a single assignment.

- `POST /schedules/:scheduleId/jobs` – enqueue a solver job (supports `Idempotency-Key` header).
- `GET /jobs/:jobId` – poll job status & phase.
- `GET /jobs/:jobId/artifacts` – list job artifacts (normalized input, solver output, KPIs, etc.).
- `GET /jobs/:jobId/preview` – preview solver output (read‑only).
- `POST /jobs/:jobId/apply` – persist solver output into schedule (`overwriteManualChanges` flag).
- `POST /jobs/:jobId/cancel` – cancel an in‑progress job.

### Messages

All message endpoints are JWT‑protected via `JwtAuthGuard`.

- `POST /workers/:workerId/messages` – create a message for a worker
  - Body (`CreateWorkerMessageDto`):
    - Optional sender: `senderUserId`, `senderWorkerId`.
    - Routing: `organizationId`, optional `unitId`.
    - Metadata: `direction` (`INBOUND` | `OUTBOUND`), `status` (`SENT` | `DELIVERED` | `READ` | `ARCHIVED`).
    - Content: `subject?`, **`body`** (required).
    - Links: optional `jobId`, `scheduleId`, `shiftDate` (`YYYY-MM-DD`), `shiftCode`.
    - `attributes?: Record<string, any>` – free‑form JSON.

- `GET /workers/:workerId/messages` – list messages for a worker
  - Query (`ListWorkerMessagesQueryDto`): `unitId`, `jobId`, `status`, `direction`, `limit`, `offset`, `sort=ASC|DESC`.
  - Returns `{ total, items, limit, offset }`.

- `GET /units/:unitId/messages` – “manager inbox” view of messages in a unit
  - Query: `jobId`, `status`, `direction`, `limit`, `offset`, `sort`.

- `GET /jobs/:jobId/messages` – messages linked to a specific solver job
  - Query: `unitId`, `status`, `direction`, `limit`, `offset`, `sort`.

### Orchestrator

Entry point for running a schedule workflow either via the **local runner** or **AWS Step Functions**, depending on env configuration.

- `POST /orchestrator/run`
  - Body (`RunOrchestratorDto`):
    - `scheduleId: string` – target schedule.
    - `idempotencyKey?: string` – optional, up to 256 chars.
    - `dto`:
      - `startDate: string` – ISO8601.
      - `endDate: string` – ISO8601.
      - `strategy?: Record<string, any>`.
      - `solverConfig?: Record<string, any>`.
      - `options?: Record<string, any>`.
      - `notes?: string`.
  - Behavior:
    - If mode is `LOCAL_RUNNER`: enqueues a local job and returns `{ ok: true, mode: 'LOCAL_RUNNER', job }`.
    - If mode is `STEP_FUNCTIONS`:
      - Enqueues the job.
      - Starts Step Functions execution using `SCHEDULE_WORKFLOW_ARN`/`MAYWIN_SFN_ARN`.
      - Returns execution metadata: `arn`, `startDate`, `name`, `stateMachineArn`.

---

## Running with Docker (optional)

A `docker-compose.yml` file is included to run this backend together with additional services (e.g. chatbot and Rasa). It assumes a directory layout with `backend/chatbot` and `backend/temp` for the chatbot and solver containers.

If your local directory structure matches that compose file, you can start the stack with:

```bash
docker compose up --build
```

Otherwise, treat `docker-compose.yml` as a reference and adjust paths/services as needed.

---

## Development notes

- All business endpoints are guarded by `JwtAuthGuard` and expect a valid JWT issued by `/auth/login`.
- Global HTTP prefix is set in `src/main.ts` via `app.setGlobalPrefix('/api/v1/core')`.
- TypeORM logging is enabled by default; adjust in `src/database/typeorm.config.ts` for production.
- Do **not** enable `synchronize: true` on production databases; migrations and the schema SQL should be used for schema changes.
- Orchestration:
  - `ORCHESTRATION_MODE` / `MAYWIN_ORCHESTRATION_MODE` controls whether `/orchestrator/run` talks to the local runner only or also to AWS Step Functions.
  - Ensure `AWS_REGION` and `SCHEDULE_WORKFLOW_ARN`/`MAYWIN_SFN_ARN` are set when using Step Functions.
- S3 artifacts:
  - `S3ArtifactsService` writes JSON artifacts to `MAYWIN_ARTIFACTS_BUCKET` under `MAYWIN_ARTIFACTS_PREFIX` (if set).
