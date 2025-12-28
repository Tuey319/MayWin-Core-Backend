# MayWin Nurse Scheduling Platform – Core Backend

NestJS + PostgreSQL backend for nurse scheduling. It manages organizations, units, workers, availability, preferences and runs an OR-Tools based optimization solver (Python) to generate nurse schedules.

---

## Tech stack

- **Runtime**: Node.js (NestJS 11, TypeScript)
- **Database**: PostgreSQL (schema `maywin_db`)
- **ORM**: TypeORM
- **Auth**: JWT (Bearer tokens)
- **Solver**: Python 3 + FastAPI + OR-Tools (`src/core/solver/solver_cli.py`)

All HTTP routes are mounted under the global prefix:

- `http://<host>:<port>/api/v1/core/*`

---

## Features

- Authentication (`/auth/login`, `/auth/me`) with unit- and role-aware JWT payloads.
- Organizations, sites, units and workers (core domain entities).
- Worker availability and preferences for a date range.
- Unit configuration: shift templates, coverage rules, constraint profiles.
- Schedule lifecycle:
  - create schedule containers per unit + horizon
  - request async solver jobs
  - preview solver output
  - apply solver output into persisted schedules
  - manually edit individual schedule assignments.
- OR-Tools based solver with strict/relaxed/MILP fallback plans and KPIs.

---

## Getting started

### 1. Prerequisites

- Node.js **18+** and npm
- PostgreSQL **13+**
- Python **3.10+** (for the solver) with `pip`

### 2. Install dependencies

```bash
npm install
```

Install Python dependencies for the solver (recommended to use a virtualenv in `src/core/solver`):

```bash
cd src/core/solver
python -m venv .venv
# On Windows PowerShell
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

### 3. Configure environment

Create a `.env` file in the project root based on the values below:

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

The backend reads DB settings from `src/database/typeorm.config.ts` and JWT settings from `AuthModule`.

### 4. Provision the database

Create an empty PostgreSQL database (matching `DB_NAME`) and run the schema SQL:

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f src/database/schema/maywin_schema.sql
```

Alternatively you can use TypeORM migrations (once configured):

```bash
# Uses src/database/data-source.ts
yarn typeorm migration:run
# or
npm run migration:run
```

> Note: the application expects the tables, enums and schema created by `src/database/schema/maywin_schema.sql`.

### 5. Run the backend

From the project root:

```bash
# Watch mode (development)
npm run dev

# One-off start (no watch)
npm run start
```

The service listens on `http://localhost:${PORT}/api/v1/core` (default: `http://localhost:3000/api/v1/core`).

To verify health:

```bash
curl http://localhost:3000/api/v1/core/health
```

You should see a JSON response with status `ok`.

---

## Python solver integration

The NestJS backend does **not** talk to the solver over HTTP; it spawns a Python CLI process using `SolverAdapter`:

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
- `WorkerPreferencesModule` – per-worker, per-unit preferences.
- `UnitConfigModule` (+ submodules) – shift templates, coverage rules, constraint profiles.
- `SchedulesModule` – schedule containers and exports.
- `JobsModule` – orchestration of async solver runs and artifacts.
- `NormalizerModule` – builds `NormalizedInput.v1` payload for the solver.
- `SolverModule` – `SolverAdapter` integration with the Python solver.

### Database

- Schema file: `src/database/schema/maywin_schema.sql` (creates schema `maywin_db`).
- Entities are grouped under `src/database/entities/*` and registered in `DatabaseModule`.
- Orchestration tables track schedule jobs, solver runs and artifacts.

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

### Units & workers

- `GET /units/:unitId/workers` – list workers in a unit (searchable by `?search=`).

### Unit configuration

- `GET /units/:unitId/config` – one-shot configuration payload for scheduling UI.
- `GET /units/:unitId/shift-templates` – list active shift templates.
- `POST /units/:unitId/shift-templates` – create a shift template.
- `PATCH /units/:unitId/shift-templates/:id` – update a shift template.
- `DELETE /units/:unitId/shift-templates/:id` – soft-delete a shift template.

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

- `GET /units/:unitId/availability?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`
- `PUT /units/:unitId/availability` – bulk upsert entries.

- `GET /workers/:workerId/preferences` – fetch stored preferences.
- `PUT /workers/:workerId/preferences` – upsert preferences for a worker & unit.

### Scheduling & jobs

- `POST /units/:unitId/schedules` – create a schedule container for a date horizon.
- `GET /units/:unitId/schedules/current?dateFrom&dateTo` – current schedule + assignments.
- `GET /units/:unitId/schedules/history?limit=` – list past schedules.
- `GET /schedules/:scheduleId` – schedule detail.
- `GET /schedules/:scheduleId/export?format=pdf|csv` – export schedule (implementation-specific).

- `PATCH /schedule-assignments/:assignmentId` – manually override a single assignment.

- `POST /schedules/:scheduleId/jobs` – enqueue a solver job (supports `Idempotency-Key` header).
- `GET /jobs/:jobId` – poll job status & phase.
- `GET /jobs/:jobId/artifacts` – list job artifacts (normalized input, solver output, KPIs, etc.).
- `GET /jobs/:jobId/preview` – preview solver output (read-only).
- `POST /jobs/:jobId/apply` – persist solver output into schedule (`overwriteManualChanges` flag).
- `POST /jobs/:jobId/cancel` – cancel an in-progress job.

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
