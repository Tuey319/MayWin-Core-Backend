# MayWin Core Backend — Developer Guide

> For developers joining the project or adding new features. This guide covers architecture, patterns, and step-by-step instructions for extending the backend.

---

## Table of Contents

1. [Tech Stack & Project Overview](#1-tech-stack--project-overview)
2. [Directory Structure](#2-directory-structure)
3. [How to Run Locally](#3-how-to-run-locally)
4. [Architecture: Module Pattern (NestJS)](#4-architecture-module-pattern-nestjs)
5. [Structure for Adding New Endpoints](#5-structure-for-adding-new-endpoints)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Database Access with TypeORM](#7-database-access-with-typeorm)
8. [Organizational Hierarchy](#8-organizational-hierarchy)
9. [Existing API Endpoints Reference](#9-existing-api-endpoints-reference)
10. [Checklist for New Module](#10-checklist-for-new-module)
11. [Common Patterns Cheatsheet](#11-common-patterns-cheatsheet)
12. [Environment Variables](#12-environment-variables)

---

## 1. Tech Stack & Project Overview

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| Database | PostgreSQL + TypeORM ORM |
| Authentication | JWT Bearer tokens + OTP 2FA |
| Solver | Python 3 + OR-Tools (spawned as child process) |
| Cloud (optional) | AWS S3 (artifacts), AWS Step Functions (orchestration) |
| Base URL | `http://localhost:3000/api/v1/core/` |

MayWin is a **nurse scheduling platform**. The backend manages organizations, units, workers (nurses), schedules, and an integrated optimization solver that auto-generates shift assignments.

---

## 2. Directory Structure

```
src/
├── app.module.ts               # Root module — imports all feature modules
├── main.ts                     # Bootstrap (port 3000, global prefix /api/v1/core)
│
├── common/
│   ├── decorators/             # @Roles() decorator
│   └── guards/                 # JwtAuthGuard (validates Bearer JWT)
│
├── core/                       # All business logic lives here
│   ├── auth/                   # Login, OTP 2FA, JWT issuance, signup
│   ├── organizations/          # Org management
│   ├── units/                  # Unit CRUD + membership
│   ├── sites/                  # Site (container for units)
│   ├── roles/                  # Role definitions
│   ├── staff/                  # Staff/user management
│   ├── workers/                # Worker CRUD + KPI dashboard
│   ├── worker-preferences/     # Shift preference penalties
│   ├── availability/           # Worker availability calendars
│   ├── scheduling/             # Schedule CRUD + manual assignments
│   ├── unit-config/
│   │   ├── shift-templates/    # Shift type definitions
│   │   ├── coverage-rules/     # Min/max workers per shift per day type
│   │   └── constraint-profiles/# Solver constraint configuration
│   ├── normalizer/             # Converts DB data → Python solver input
│   ├── solver/                 # Python solver adapter (spawns CLI)
│   ├── orchestrator/           # AWS Step Functions OR local job runner
│   ├── jobs/                   # Solver job lifecycle (create, poll, apply)
│   ├── messages/               # Worker inbox
│   ├── audit-logs/             # Audit trail
│   ├── webhook/                # Webhooks
│   ├── mail/                   # Email (OTP delivery, notifications)
│   ├── mock-csv/               # CSV import utilities
│   └── jobs-runner.service.ts  # Async job execution engine
│
└── database/
    ├── entities/               # 27 TypeORM entity definitions
    │   ├── core/               # Organization, Unit, Role, Site
    │   ├── users/              # User, UserRole, UnitMembership, AuthOtp
    │   ├── workers/            # Worker, WorkerUnitMembership, WorkerAvailability, WorkerPreference
    │   ├── scheduling/         # Schedule, ScheduleAssignment, ShiftTemplate, CoverageRule, ConstraintProfile
    │   └── orchestration/      # ScheduleJob, ScheduleArtifact, ScheduleJobEvent, SolverRun
    ├── database.module.ts      # TypeORM initialization
    ├── typeorm.config.ts       # DB connection config
    ├── migrations/             # Schema migrations
    └── buckets/                # S3 artifacts service
```

---

## 2.1 Key Files (Jobs & Solver Subsystem)

When debugging scheduling issues or undercoverage, focus on:

| File | Purpose |
|---|---|
| `src/core/jobs/jobs.controller.ts` | Job CRUD endpoints + new `GET /jobs/:jobId/solver-payload` |
| `src/core/jobs/jobs.service.ts` | Job lifecycle, artifact retrieval, payload normalization |
| `src/core/normalizer/normalizer.service.ts` | Builds NormalizedInputV1 from DB (the input sent to solver) |
| `src/core/solver/solver.adapter.ts` | Converts normalized input → Python solver CLI, parses output |
| `src/core/solver/solver_cli.py` | Python OR-Tools solver entry point |
| `src/core/orchestrator/orchestrator.service.ts` | AWS Step Functions or local runner orchestration |

---

## 3. How to Run Locally

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your DB credentials and secrets

# Run in watch mode (development)
npm run dev

# Build for production
npm run build
npm run start:prod

# Run database migrations
npm run migration:run
```

**Required `.env` values to get started:**
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=maywin12345
DB_NAME=maywin
DB_SCHEMA=maywin_db
JWT_SECRET=your-secret-key
AUTH_DISABLE_OTP=true          # Set true for local dev (skips 2FA email)
ORCHESTRATION_MODE=LOCAL_RUNNER
```

---

## 3.1 Debugging Schedule Undercoverage

If a schedule job produces fewer assignments than expected:

1. **Get the normalized payload:**
   ```bash
   GET /api/v1/core/jobs/{jobId}/solver-payload
   ```

2. **Inspect the payload:**
   - Check `availabilityRestrictions`: Are workers blocked for the missing shifts?
   - Check `coverageRules`: Are demand values correct?
   - Check `nurses[].regularShiftsPerPeriod`, `maxOvertimeShifts`: Are caps too tight?
   - Check `constraints.forbidNightToMorning`, `forbidEveningToNight`: Are sequence rules overconstrained?

3. **Fix data issues in DB (SQL):**
   ```sql
   -- Example: Remove unavailability block for a worker on a specific date/shift
   DELETE FROM maywin_db.worker_availability
   WHERE worker_id = '123' AND date = '2026-03-31' AND shift_code = 'NIGHT'
     AND type::text IN ('UNAVAILABLE', 'DAY_OFF');

   -- Example: Increase a worker's max overtime shifts
   UPDATE maywin_db.constraint_profile
   SET max_overtime_shifts = 8 WHERE id = 1;
   ```

4. **Rerun the job** and check if coverage improves.

---

## 4. Architecture: Module Pattern (NestJS)

Every feature follows the same **Module → Controller → Service → Entity** pattern.

```
HTTP Request
     ↓
Controller     ← Handles routing, extracts JWT context, validates DTOs
     ↓
Service        ← Business logic, DB queries, throws NestJS exceptions
     ↓
Repository     ← TypeORM CRUD against PostgreSQL
     ↓
Entity         ← Defines table schema and column types
```

Each feature lives in its own **NestJS Module** (`*.module.ts`). The module declares which controllers and services it owns, and which entities/repos it needs from the database:

```typescript
// src/core/units/units.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Unit, UnitMembership])],  // DB entities
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],  // Allow other modules to inject this service
})
export class UnitsModule {}
```

All feature modules are imported in `src/app.module.ts`. **When you create a new module, register it there.**

---

## 5. Structure for Adding New Endpoints

### Example: Adding `POST /units/:unitId/reports`

---

### Step 1 — Create a DTO (input validation)

**File:** `src/core/units/dto/create-report.dto.ts`

```typescript
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateReportDto {
  @IsString()
  reportName!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  format?: string;  // 'pdf' | 'csv'
}
```

Common validators from `class-validator`:

| Decorator | Use case |
|---|---|
| `@IsString()` | Any text field |
| `@IsEmail()` | Email addresses |
| `@IsDateString()` | ISO date strings (`"2026-03-09"`) |
| `@IsNumber()` | Numeric values |
| `@IsBoolean()` | `true` / `false` |
| `@IsOptional()` | Field is not required |
| `@IsNotEmpty()` | Disallow empty strings |
| `@Matches(/regex/)` | Custom pattern |

---

### Step 2 — Add method to Service

**File:** `src/core/units/units.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from '@/database/entities/core/unit.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit) private readonly unitsRepo: Repository<Unit>,
  ) {}

  async createReport(
    ctx: { organizationId: number; roles: string[] },
    unitId: string,
    dto: CreateReportDto,
  ) {
    // 1. Verify the unit belongs to the caller's org
    const unit = await this.unitsRepo.findOne({
      where: { id: unitId, organization_id: String(ctx.organizationId) },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    // 2. Business logic here
    return {
      id: crypto.randomUUID(),
      unitId,
      ...dto,
      createdAt: new Date().toISOString(),
    };
  }
}
```

**Common NestJS exceptions to throw from services:**

| Exception | HTTP Status |
|---|---|
| `NotFoundException` | 404 |
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `ConflictException` | 409 |
| `InternalServerErrorException` | 500 |

---

### Step 3 — Add route to Controller

**File:** `src/core/units/units.controller.ts`

```typescript
import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UnitsService } from './units.service';
import { CreateReportDto } from './dto/create-report.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class UnitsController {
  constructor(private readonly svc: UnitsService) {}

  // Helper: extract caller context from the JWT token
  private ctx(req: Request) {
    const u = (req as any).user ?? {};
    return {
      organizationId: Number(u.organizationId),
      roles: Array.isArray(u.roles) ? u.roles : [],
      unitIds: Array.isArray(u.unitIds) ? u.unitIds : [],
    };
  }

  @Post('/units/:unitId/reports')
  createReport(
    @Req() req: Request,
    @Param('unitId') unitId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.svc.createReport(this.ctx(req), unitId, dto);
  }
}
```

**Controller decorators reference:**

| Decorator | Purpose |
|---|---|
| `@Get('/path')` | HTTP GET |
| `@Post('/path')` | HTTP POST |
| `@Patch('/path/:id')` | HTTP PATCH (partial update) |
| `@Put('/path/:id')` | HTTP PUT (full replace) |
| `@Delete('/path/:id')` | HTTP DELETE |
| `@Param('id')` | URL path parameter |
| `@Query()` | Query string (`?key=value`) |
| `@Body()` | Request body (typed by DTO) |
| `@Req()` | Full request object (for JWT user) |
| `@UseGuards(JwtAuthGuard)` | Require authentication |

---

### Step 4 — Register Entity in Module (if using a new entity)

**File:** `src/core/units/units.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unit } from '@/database/entities/core/unit.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [TypeOrmModule.forFeature([Unit])],  // Add new entities here
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
```

---

### Step 5 — Register the Module in AppModule (new modules only)

**File:** `src/app.module.ts`

```typescript
import { MyNewModule } from './core/my-new-feature/my-new.module';

@Module({
  imports: [
    // ... existing modules
    MyNewModule,
  ],
})
export class AppModule {}
```

---

### Step 6 — Build & Test

```bash
npm run build

curl -X POST http://localhost:3000/api/v1/core/units/2/reports \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Weekly Report",
    "startDate": "2026-03-09",
    "endDate": "2026-03-15",
    "format": "pdf"
  }'
```

---

### Endpoint Flow Diagram

```
POST /api/v1/core/units/:unitId/reports
  → JwtAuthGuard validates Bearer token
  → Controller extracts { organizationId, roles, unitIds } from req.user
  → @Body() is deserialized into CreateReportDto
  → Controller calls svc.createReport(ctx, unitId, dto)
  → Service validates unit ownership (same organizationId)
  → Service performs business logic
  → Returns JSON response
```

---

## 6. Authentication & Authorization

### JWT Flow

```
1. POST /auth/login       { email, password }
   → Validates credentials
   → Sends OTP to email
   → Returns short-lived OTP-pending token

2. POST /auth/verify-otp  { token, code }
   → Validates 6-digit OTP
   → Returns full JWT (8-hour expiry)

3. All other endpoints:
   GET /api/v1/core/...
   Authorization: Bearer <jwt>
   → JwtAuthGuard validates signature
   → req.user = { sub, organizationId, roles, unitIds }
```

> For local development, set `AUTH_DISABLE_OTP=true` to skip the OTP step and get a JWT directly from `/auth/login`.

### JWT Payload

```typescript
interface JwtPayload {
  sub: number;            // user ID
  organizationId: number; // org scoping — all queries filter by this
  roles: string[];        // global roles (e.g. ['ADMIN', 'MANAGER'])
  unitIds: number[];      // units the user has access to
}
```

### Extracting the Caller's Context

Every controller method extracts the caller's identity from the JWT via this helper:

```typescript
private ctx(req: Request) {
  const u = (req as any).user ?? {};
  return {
    organizationId: Number(u.organizationId),
    roles: Array.isArray(u.roles) ? u.roles : [],
    unitIds: Array.isArray(u.unitIds) ? u.unitIds : [],
  };
}
```

Always scope service queries to `ctx.organizationId` to prevent cross-organization data leakage.

---

## 7. Database Access with TypeORM

### Entity Definition Pattern

**File:** `src/database/entities/<domain>/<name>.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'workers' })
@Unique('workers_org_code_uniq', ['organization_id', 'worker_code'])
export class Worker {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;  // BigInt IDs come back as strings from pg

  @Column({ type: 'bigint' })
  organization_id: string;

  @Column({ type: 'text' })
  full_name: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
```

### Common Repository Operations

```typescript
// Find one
const entity = await repo.findOne({ where: { id, organization_id: String(orgId) } });
if (!entity) throw new NotFoundException('Not found');

// Find many (with filters)
const list = await repo.find({
  where: { organization_id: String(orgId), is_active: true },
  order: { created_at: 'DESC' },
});

// Advanced filters
import { Between, In, IsNull, Like } from 'typeorm';
await repo.find({
  where: {
    created_at: Between(start, end),
    role_id: In(allowedIds),
    deleted_at: IsNull(),
  },
});

// Create & save
const entity = repo.create({ name: 'John', organization_id: String(orgId) });
const saved = await repo.save(entity);

// Update
entity.name = 'Jane';
await repo.save(entity);

// Soft delete (preferred — set is_active = false)
entity.is_active = false;
await repo.save(entity);

// Hard delete
await repo.delete({ id: entityId });
```

### All 29 Entities

| Domain | Entities |
|---|---|
| Core | `Organization`, `Unit`, `Role`, `Site` |
| Users | `User`, `UserRole`, `UnitMembership`, `AuthOtp`, `DisplaySettings`, `ExportOptions` |
| Workers | `Worker`, `WorkerUnitMembership`, `WorkerAvailability`, `WorkerPreference` |
| Scheduling | `Schedule`, `ScheduleAssignment`, `ShiftTemplate`, `CoverageRule`, `ConstraintProfile`, `ScheduleRun` |
| Orchestration | `ScheduleJob`, `ScheduleArtifact`, `ScheduleJobEvent`, `SolverRun`, `SolverRunAssignment` |

---

## 8. Organizational Hierarchy

```
Organization
├── Site (optional grouping of units)
│   └── Unit
└── Unit (can exist without a site)
    ├── Worker  (via WorkerUnitMembership)
    │   ├── WorkerAvailability  (per date/shift: available or not)
    │   ├── WorkerPreference    (penalty scores per date/shift)
    │   └── WorkerMessages      (inbox)
    ├── Schedule  (per scheduling horizon)
    │   ├── ScheduleAssignment  (nurse → date → shift)
    │   └── ScheduleJob         (solver run request)
    └── Config
        ├── ShiftTemplate       (e.g. Morning 06:00–14:00)
        ├── CoverageRule        (min/max workers per shift × day type)
        └── ConstraintProfile   (solver parameters and weights)

User
├── UnitMembership  (unit-scoped role)
├── UserRole        (global role)
└── Organization    (belongs to one org)
```

**Key rule:** All queries must be scoped to `organization_id` from the JWT. Never return data from other organizations.

---

## 9. Existing API Endpoints Reference

All routes are prefixed with `/api/v1/core/`. All require `Authorization: Bearer <jwt>` unless marked public.

### Auth
```
POST  /auth/login               Login (returns OTP-pending token)
POST  /auth/verify-otp          Verify OTP → returns full JWT
POST  /auth/signup              Create account → returns JWT
POST  /auth/logout
GET   /auth/me                  Current user from JWT
```

### Organizations & Units
```
GET   /organizations
GET   /organizations/me
POST  /organizations
PATCH /organizations/:orgId
DELETE /organizations/:orgId

GET   /units
GET   /units/:unitId
POST  /units
PATCH /units/:unitId
POST  /units/:unitId/deactivate
DELETE /units/:unitId
GET   /units/:unitId/members
POST  /units/:unitId/members
DELETE /units/:unitId/members/:userId
```

### Schedules & Jobs
```
GET   /schedules
POST  /units/:unitId/schedules
GET   /units/:unitId/schedules/current
GET   /units/:unitId/schedules/history
GET   /schedules/:scheduleId
GET   /schedules/:scheduleId/export

POST  /schedules/:scheduleId/jobs    Create solver job
GET   /jobs/:jobId                   Poll job status
GET   /jobs/:jobId/artifacts         List artifacts
GET   /jobs/:jobId/preview           Preview solver output
POST  /jobs/:jobId/apply             Commit solver results to schedule
POST  /jobs/:jobId/cancel

POST  /orchestrator/run
```

### Unit Configuration
```
POST   /units/:unitId/shift-templates
PATCH  /units/:unitId/shift-templates/:id
DELETE /units/:unitId/shift-templates/:id

POST   /units/:unitId/coverage-rules
PATCH  /units/:unitId/coverage-rules/:id

GET    /constraint-profiles
GET    /units/:unitId/constraint-profiles
POST   /units/:unitId/constraint-profiles
PATCH  /units/:unitId/constraint-profiles/:id
POST   /units/:unitId/constraint-profiles/:id/activate

GET    /organizations/:orgId/constraint-profiles
POST   /organizations/:orgId/constraint-profiles
PUT    /organizations/:orgId/constraint-profiles/:id
DELETE /organizations/:orgId/constraint-profiles/:id
```

### Workers & Availability
```
GET   /units/:unitId/workers
GET   /units/:unitId/kpis/summary
GET   /nurses/export?unitId=...      (BFF compatibility)

PATCH /schedule-assignments/:id
DELETE /schedule-assignments/:id

GET   /units/:unitId/availability
PUT   /units/:unitId/availability
```

### Messages
```
GET   /worker-messages
POST  /worker-messages
GET   /worker-messages/:id
POST  /worker-messages/:id/read
```

### Display Settings (user-scoped)
```
GET   /display-settings/me     Current user's display settings (shift colours, OT style)
PUT   /display-settings/me     Save/replace current user's display settings
```

### Export Options (user-scoped)
```
GET   /export-options/me       Current user's default Excel export options
PUT   /export-options/me       Save/replace current user's export options
```

---

## 10. Checklist for New Module

### For a new endpoint in an existing module:
- [ ] Create DTO in `src/core/<module>/dto/`
- [ ] Add method to `<module>.service.ts`
- [ ] Add route to `<module>.controller.ts`
- [ ] Run `npm run build` and test with curl or Postman

### For a brand new module:
- [ ] Create folder `src/core/<module>/`
- [ ] Create `<module>.module.ts`
- [ ] Create `<module>.controller.ts`
- [ ] Create `<module>.service.ts`
- [ ] Create `dto/` folder with DTO files
- [ ] If new DB table needed: create entity in `src/database/entities/<domain>/`
- [ ] Add entity to `TypeOrmModule.forFeature([...])` in module
- [ ] Register module in `src/app.module.ts`
- [ ] Run `npm run migration:generate` to generate migration
- [ ] Run `npm run migration:run` to apply migration
- [ ] Run `npm run build` and test

---

## 11. Common Patterns Cheatsheet

### Inject and use a repository
```typescript
constructor(
  @InjectRepository(Worker) private readonly workersRepo: Repository<Worker>,
) {}
```

### Org-scoped query (always do this)
```typescript
const results = await this.repo.find({
  where: { organization_id: String(ctx.organizationId) }
});
```

### Throw a 404
```typescript
const entity = await repo.findOne({ where: { id } });
if (!entity) throw new NotFoundException(`Entity ${id} not found`);
```

### Use another module's service
```typescript
// In your module file, import the other module:
@Module({
  imports: [UnitsModule],  // UnitsModule must export UnitsService
  ...
})

// In your service constructor:
constructor(private readonly unitsService: UnitsService) {}
```

### Log for debugging
```typescript
import { Logger } from '@nestjs/common';
private readonly logger = new Logger(MyService.name);
this.logger.log('Doing something...');
this.logger.error('Something failed', err);
```

---

## 12. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | DB username | — |
| `DB_PASSWORD` | DB password | — |
| `DB_NAME` | Database name | `maywin` |
| `DB_SCHEMA` | PostgreSQL schema | `maywin_db` |
| `JWT_SECRET` | JWT signing secret | — |
| `AUTH_DISABLE_OTP` | Skip 2FA (dev only) | `false` |
| `AUTH_ALLOW_OTP_LOG_FALLBACK` | Log OTP if email fails | `false` |
| `SOLVER_PYTHON` | Python executable | `python3` |
| `SOLVER_CLI_PATH` | Path to solver_cli.py | `src/core/solver/solver_cli.py` |
| `ORCHESTRATION_MODE` | `LOCAL_RUNNER` or `STEP_FUNCTIONS` | `LOCAL_RUNNER` |
| `AWS_REGION` | AWS region | `ap-southeast-1` |
| `SCHEDULE_WORKFLOW_ARN` | Step Functions ARN | — |

---

*For solver architecture details, see [SOLVER_LOGIC.md](./SOLVER_LOGIC.md).*
*For full API reference, see [API.md](./API.md).*
*For system architecture overview, see [SYSTEM.md](./SYSTEM.md).*
