# Contributing to MayWin Core Backend

Thank you for contributing to the MayWin Nurse Scheduling Platform. Please read this guide fully before opening a pull request.

## Table of Contents

- [Who to Contact](#who-to-contact)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Authentication & Authorization](#authentication--authorization)
- [Org Scoping — Mandatory](#org-scoping--mandatory)
- [Audit Logging](#audit-logging)
- [Testing](#testing)
- [Database Migrations](#database-migrations)
- [Submitting Changes & Pull Request Process](#submitting-changes--pull-request-process)

---

## Who to Contact

For any questions, blockers, or issues — reach out before guessing:

| Person | Role | Contact |
|--------|------|---------|
| **Tuey** (Tueychirayu) | Lead / Backend Owner | tueychirayu@gmail.com |
| **Ken** | Backend Contributor | *(ask Tuey for Ken's contact)* |

If something is unclear in the codebase, ask. Do not make assumptions about business logic — especially for the solver, scheduling, or RBAC.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [npm](https://www.npmjs.com/) v9 or later
- [Docker](https://www.docker.com/) and Docker Compose (for local database)
- [Python](https://www.python.org/) 3.10+ with `or-tools` installed (for the solver)
- [NestJS CLI](https://docs.nestjs.com/cli/overview): `npm install -g @nestjs/cli`
- AWS CLI (optional — only needed when working with S3 or Step Functions)

---

## Local Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/WinterJet2021/May-Win-NSP-Project.git
   cd May-Win-NSP-Project
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Minimum variables to get started locally:

   | Variable | Description | Local default |
   |----------|-------------|---------------|
   | `DB_HOST` | PostgreSQL host | `localhost` |
   | `DB_PORT` | PostgreSQL port | `5432` |
   | `DB_NAME` | Database name | `maywin` |
   | `DB_USER` | Database user | `postgres` |
   | `DB_PASSWORD` | Database password | `maywin12345` |
   | `DB_SCHEMA` | Database schema | `maywin_db` |
   | `JWT_SECRET` | Secret key for JWT signing | any string |
   | `JWT_EXPIRES_IN` | JWT token expiry | `7d` |
   | `AUTH_DISABLE_OTP` | Skip 2FA email in dev | `true` |
   | `ORCHESTRATION_MODE` | Runner mode | `LOCAL_RUNNER` |

   S3/AWS variables are only required when working on the solver pipeline or audit log S3 mode. Omit them and audit logs will write to the local filesystem under `/tmp/<orgId>/audit-logs.csv`.

4. **Start the local database**

   ```bash
   docker-compose up -d db
   ```

   This starts PostgreSQL 16 on port `5433`.

5. **Run database migrations**

   ```bash
   npm run migration:run
   ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

   The API is available at `http://localhost:3000/api/v1/core/`.

---

## Project Structure

```
src/
├── common/
│   ├── decorators/         # @Roles(), @Public()
│   └── guards/             # JwtAuthGuard, RolesGuard (global APP_GUARD)
│
├── core/                   # All business logic
│   ├── auth/               # Login, OTP 2FA, JWT issuance, signup
│   ├── organizations/      # Org management
│   ├── units/              # Unit CRUD + membership
│   ├── sites/              # Site (grouping container for units)
│   ├── staff/              # Staff/user management
│   ├── workers/            # Worker CRUD + KPI dashboard
│   ├── worker-preferences/ # Shift preference penalties
│   ├── availability/       # Worker availability calendars
│   ├── scheduling/         # Schedule CRUD + manual assignments
│   ├── unit-config/
│   │   ├── shift-templates/
│   │   ├── coverage-rules/
│   │   └── constraint-profiles/
│   ├── normalizer/         # Converts DB data → Python solver input
│   ├── solver/             # Python solver adapter (spawns CLI)
│   ├── orchestrator/       # AWS Step Functions or local job runner
│   ├── jobs/               # Solver job lifecycle
│   ├── audit-logs/         # Per-org audit trail (CSV / S3)
│   ├── mail/               # Email notifications
│   └── mock-csv/           # CSV parsing utilities
│
└── database/
    ├── entities/           # 29 TypeORM entity definitions
    ├── migrations/         # Schema migration files
    ├── typeorm.config.ts
    └── buckets/            # S3 service wrapper
```

Every feature follows the **Module → Controller → Service → Entity** pattern. Each module owns its own folder. New modules must be registered in `src/app.module.ts`.

---

## Development Workflow

1. **Branch from `main`**

   ```bash
   git checkout -b feat/your-feature-name
   git checkout -b fix/your-bug-description
   git checkout -b refactor/what-you-changed
   git checkout -b chore/tooling-or-config
   ```

   Branch naming convention:

   | Prefix | Use |
   |--------|-----|
   | `feat/` | New feature |
   | `fix/` | Bug fix |
   | `refactor/` | Refactoring with no behavior change |
   | `chore/` | Tooling, config, dependency updates |

2. **Commit with Conventional Commits**

   ```
   feat: add per-org audit log scoping
   fix: resolve JWT expiry handling in auth guard
   refactor: extract scheduling logic into service layer
   chore: upgrade NestJS to v11
   ```

3. **Before pushing**, run:

   ```bash
   npx tsc --noEmit   # TypeScript — no errors allowed
   npm test           # All tests must pass
   ```

4. **Push and open a pull request against `main`** — see the [PR process](#submitting-changes--pull-request-process) below.

---

## Coding Standards

- **TypeScript only.** No `any` types without an explicit comment explaining why.
- **NestJS patterns.** Use decorators, guards, interceptors, and pipes as intended. Do not bypass the framework.
- **Validation.** Use `class-validator` DTOs on all incoming request bodies. Never trust raw request fields.
- **Auth on every route.** Every controller must have `@UseGuards(JwtAuthGuard)`. Use `@Public()` only for genuinely unauthenticated endpoints (`/auth/login`, `/auth/signup`).
- **No cross-org data leakage.** Every query that touches org-owned data must be filtered by `organizationId` from the JWT. See [Org Scoping](#org-scoping--mandatory).
- **Error handling.** Throw the correct NestJS exception from the service layer — never return raw error strings from controllers.

  | Exception | HTTP |
  |-----------|------|
  | `NotFoundException` | 404 |
  | `BadRequestException` | 400 |
  | `UnauthorizedException` | 401 |
  | `ForbiddenException` | 403 |
  | `ConflictException` | 409 |

- **Comments.** Only write a comment when the *why* is non-obvious — a hidden constraint, a workaround, a subtle invariant. Don't describe what the code does.

---

## Authentication & Authorization

### Role Hierarchy

```
nurse < head_nurse < department_head < hospital_admin < super_admin
```

`RolesGuard` is registered globally as `APP_GUARD`. Declare the minimum required role on every controller or route handler:

```typescript
@Roles('head_nurse')               // all routes on this controller require head_nurse+
@UseGuards(JwtAuthGuard)
@Controller()
export class StaffController { ... }

@Roles('hospital_admin')           // individual route override
@Delete('/staff/:id')
remove(...) { ... }
```

A caller with a role above the declared minimum passes automatically (e.g. `hospital_admin` satisfies `@Roles('head_nurse')`).

### JWT Payload

```typescript
interface JwtPayload {
  sub: number;            // user ID
  organizationId: number; // tenant boundary — scope ALL queries to this
  roles: string[];        // e.g. ['head_nurse']
  unitIds: number[];      // units the user has direct membership in
}
```

### Active Role Codes

Use only these five — the old codes (`admin`, `scheduler`, `viewer`) are legacy and must not be used:

| Code | Level |
|------|-------|
| `nurse` | 1 |
| `head_nurse` | 2 |
| `department_head` | 3 |
| `hospital_admin` | 4 |
| `super_admin` | 5 |

---

## Org Scoping — Mandatory

**Every** query against org-owned data must include the caller's `organizationId`. Never return data from another organization. This is enforced in the service layer, not just at the guard level.

```typescript
// Correct — scoped to caller's org
const worker = await this.workersRepo.findOne({
  where: { id, organization_id: String(ctx.organizationId) },
});
if (!worker) throw new NotFoundException('Worker not found');

// Wrong — would leak data across orgs
const worker = await this.workersRepo.findOne({ where: { id } });
```

Extract the caller context in the controller and pass it down to the service:

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

---

## Audit Logging

Use `AuditLogsService.append()` whenever a privileged action is performed (create, update, delete, link, token generation). Logs are stored **per organization** — each org gets its own file at `logs/{orgId}/audit-logs.csv` (S3) or `/tmp/{orgId}/audit-logs.csv` (local).

```typescript
await this.auditLogs.append({
  orgId: String(organizationId),  // required — determines which org's log file is written
  actorId: actor.actorId,
  actorName: actor.actorName,
  action: 'CREATE_STAFF',
  targetType: 'staff',
  targetId: worker.worker_code,
  detail: `Created nurse ${dto.name}`,
  level: 3,
});
```

Log levels follow Winston conventions:

| Level | Meaning | Minimum role to read |
|-------|---------|----------------------|
| 0 | error | all |
| 1 | warn | all |
| 2 | info | NURSE+ |
| 3 | http | HEAD_NURSE+ |
| 4 | verbose | HOSPITAL_ADMIN+ |
| 5 | debug | SUPER_ADMIN |
| 6 | silly | SUPER_ADMIN |

---

## Testing

Run all tests:

```bash
npm test
```

Run a single file:

```bash
npx jest --testPathPattern="audit-logs" --no-coverage
```

Watch mode:

```bash
npx jest --watch
```

### What to test

- Unit tests live alongside source files as `*.spec.ts` (e.g. `src/core/audit-logs/audit-logs.service.spec.ts`).
- Integration tests live in `test/` (e.g. `test/core-audit-logs.spec.ts`).

**When adding a new feature:** write at minimum a unit test for the service layer.  
**When fixing a bug:** add a test case that would have caught the regression.

### Test coverage expectations

| Scenario | Required |
|----------|----------|
| Happy path returns correct shape | Yes |
| `NotFoundException` when record not found | Yes |
| Org mismatch rejected for non-admin caller | Yes |
| Correct org-scoped file/key used (audit logs) | Yes |
| Required fields missing → `BadRequestException` | Yes |
| Duplicate record → `ConflictException` | Yes |

### Mocking pattern

```typescript
const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const svc = new MyService(mockRepo as any);
```

Never mock the database in a way that masks real schema divergence — if you're unsure whether a test needs to hit a real DB, ask Tuey or Ken.

---

## Database Migrations

Never edit the database schema directly. All schema changes go through TypeORM migrations.

**Generate a migration** after modifying an entity:

```bash
npm run migration:generate
```

Review the generated SQL under `src/database/migrations/` before committing — make sure it only changes what you intended.

**Apply migrations** locally:

```bash
npm run migration:run
```

**Revert the last migration:**

```bash
npm run migration:revert
```

---

## Submitting Changes & Pull Request Process

### Before opening a PR

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm test` passes — all tests green
- [ ] New feature or bug fix has a corresponding test
- [ ] No `any` types added without justification
- [ ] All new routes have `@Roles()` and `@UseGuards(JwtAuthGuard)`
- [ ] All service queries are scoped to `organizationId`
- [ ] Audit log calls include `orgId` where applicable
- [ ] Migration generated and reviewed if the DB schema changed

### Opening a PR

1. Push your branch and open a pull request against `main`.
2. Fill out the PR description:
   - **What changed** and why
   - **How to test** it manually
   - Link any related issues or tickets
3. Assign **Tuey** and **Ken** as reviewers.

### Review requirement — do not merge without approval

> **You must not merge your own pull request.**
>
> Wait for at least one approval from **Tuey** or **Ken** before merging. Both reviewers will be notified automatically when a PR is opened.
>
> If your PR has been open for more than 2 days with no response, ping directly:
> - **Tuey:** tueychirayu@gmail.com
> - **Ken:** *(ask Tuey for Ken's contact)*

If the PR introduces breaking changes, a migration, or touches the solver/orchestrator pipeline — get approval from **both** Tuey and Ken before merging.

### After merging

- Delete your feature branch.
- If the change affects the API, update [docs/official/API.md](docs/official/API.md).
- If the change affects the DB schema, confirm the migration has been applied to the staging environment.

---

*For architecture details see [docs/official/BACKEND_DEVELOPER_GUIDE.md](docs/official/BACKEND_DEVELOPER_GUIDE.md).*  
*For solver internals see [docs/official/SOLVER_LOGIC.md](docs/official/SOLVER_LOGIC.md).*  
*For full API reference see [docs/official/API.md](docs/official/API.md).*  
*For RBAC details see [docs/miscellaneous/RBAC.md](docs/miscellaneous/RBAC.md).*  
*For testing patterns see [docs/official/TESTING.md](docs/official/TESTING.md).*
