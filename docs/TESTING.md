# MayWin Core Backend — Testing Guide

## Overview

Tests live in the `test/` directory. All tests are **unit tests** — every database call and external dependency is mocked with `jest.fn()`. No real database or network connection is required to run them.

**Framework:** Jest + ts-jest
**Run command:** `npm test`
**Coverage command:** `npm test -- --coverage`

---

## What Unit Tests Do and Don't Verify

### They DO verify
- Service method logic (correct branching, correct field mapping)
- Error throwing (`NotFoundException`, `ForbiddenException`, `BadRequestException`, `ConflictException`)
- Authorization checks (org ownership, ADMIN bypass, inactive worker rejection)
- Return shapes (correct keys and values in the response object)
- Cache invalidation (that `cache.del` is called with the right key after mutations)
- Partial updates (only provided fields change; unprovided fields stay as-is)

### They do NOT verify
- Real SQL queries or TypeORM query generation
- Database schema or column names
- HTTP status codes (those require an e2e test)
- JWT guard rejecting a request before it reaches the service
- Network calls (S3, LINE, email)

---

## Test Files

| File | Service(s) Covered | Endpoints |
|---|---|---|
| `test/core-auth.spec.ts` | `AuthService` | `POST /auth/login`, `POST /auth/verify-otp`, `POST /auth/signup`, `POST /auth/logout` |
| `test/core-roles.spec.ts` | `RolesService` | `GET /roles` |
| `test/core-organizations.spec.ts` | `OrganizationsService` | `GET /organizations`, `GET /organizations/me`, `GET /organizations/:orgId`, `POST /organizations`, `PATCH /organizations/:orgId`, `DELETE /organizations/:orgId` |
| `test/core-sites.spec.ts` | `SitesService` | `POST /sites`, `PATCH /sites/:siteId`, `DELETE /sites/:siteId`, `PUT /sites/:siteId/activate`, `PUT /sites/:siteId/deactivate` |
| `test/core-units.spec.ts` | `UnitsService` | `GET /units/:unitId`, `POST /units`, `PATCH /units/:unitId`, `DELETE /units/:unitId`, `PUT /units/:unitId/deactivate`, `GET /units/:unitId/members`, `POST /units/:unitId/members`, `DELETE /units/:unitId/members/:userId` |
| `test/core-unit-config.spec.ts` | `ConstraintProfilesService`, `ShiftTemplatesService`, `CoverageRulesService` | Constraint profile CRUD, shift template CRUD, coverage rule CRUD + bulk replace |
| `test/core-worker-preferences.spec.ts` | `WorkerPreferencesService` | `GET /workers/:workerId/preferences`, `DELETE /workers/:workerId/preferences`, `DELETE /workers/:workerId/preferences/requests/:date` |
| `test/core-workers.spec.ts` | `WorkersService` | `GET /units/:unitId/workers`, `PUT /workers/:workerId/preferences` |
| `test/core-scheduling.spec.ts` | `SchedulesService` | `POST /units/:unitId/schedules`, `GET /units/:unitId/schedules/history`, `GET /schedules/:scheduleId`, `PATCH /schedule-assignments/:id`, `GET /schedules/:scheduleId/export` |
| `test/core-jobs.spec.ts` | `JobsService` | `POST /schedules/:scheduleId/jobs`, `GET /jobs/:jobId`, `GET /jobs/:jobId/artifacts` |
| `test/core-availability.spec.ts` | `AvailabilityService` | `GET /units/:unitId/availability`, `PUT /units/:unitId/availability` |
| `test/core-messages.spec.ts` | `WorkerMessagesService` | `POST /workers/:workerId/messages`, `POST /chat` |
| `test/core-audit-logs.spec.ts` | `AuditLogsService` | `GET /audit-logs`, `POST /audit-logs` |
| `test/core-staff.spec.ts` | `StaffService` | `GET /staff`, `GET /staff/:id`, `POST /staff`, `PATCH /staff/:id`, `DELETE /staff/:id` |

---

## Test Patterns

### Standard mock setup

Each spec file uses a local `makeSvc()` factory that builds the service with mocked repositories:

```typescript
function makeSvc(repoOverrides = {}) {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    ...repoOverrides,
  };
  const svc = new MyService(repo as any);
  return { svc, repo };
}
```

Override only the methods needed per test:

```typescript
it('throws NotFoundException when record not found', async () => {
  const { svc } = makeSvc({ findOne: jest.fn().mockResolvedValue(null) });
  await expect(svc.getById('999')).rejects.toThrow(NotFoundException);
});
```

### Services with cache

Services that use `CACHE_MANAGER` receive a mock cache:

```typescript
const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
const svc = new MyService(repo as any, cache as any);
```

Verify cache invalidation:
```typescript
expect(cache.del).toHaveBeenCalledWith('worker-prefs:list:20');
```

### Auth context (`JwtCtx`)

Services that scope queries by organization use a context object:

```typescript
const adminCtx = { organizationId: 1, roles: ['ADMIN'], unitIds: [] };
const userCtx  = { organizationId: 1, roles: ['MANAGER'], unitIds: [] };
```

---

## Common Test Cases Per Endpoint Type

| Scenario | Expected behaviour |
|---|---|
| Happy path | Returns correct response shape |
| Record not found | Throws `NotFoundException` |
| Org mismatch (non-admin) | Throws `ForbiddenException` |
| ADMIN role bypasses org check | Request succeeds |
| Inactive worker | Throws `NotFoundException` |
| Duplicate (code/email/member) | Throws `ConflictException` or `BadRequestException` |
| Missing required field | Throws `BadRequestException` |
| Partial update | Only provided fields change; others are unchanged |
| Cache hit | Returns cached value without hitting the DB |
| Cache invalidation | `cache.del` is called with the correct key after mutation |

---

## Known Pre-existing Failures

Two test files were already failing before the current test suite was written and are **not caused by the unit tests above**:

| File | Reason |
|---|---|
| `test/core-staff.spec.ts` | Uses `Test.createTestingModule` with missing provider registrations (`MailService`, `LineLinkToken` repo, `User` repo, `UnitMembership` repo) |
| `test/core-compat-routes.spec.ts` | Tests BFF/compat route wiring that depends on full NestJS module bootstrap |

These require either completing the NestJS module provider list or converting to the same direct-instantiation pattern used by the other spec files.

---

## Running a Specific File

```bash
# Single file
npx jest --testPathPattern="core-organizations" --no-coverage

# All unit tests (excludes src/**/*.spec.ts)
npx jest --testPathPattern="test/core-" --no-coverage

# Watch mode
npx jest --watch
```
