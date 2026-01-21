# 1) Overview

**Service**: MayWin Core Backend (NestJS)

**Primary purpose**: Nurse scheduling operations (organizations, sites, units, workers, availability, worker preferences, unit configuration, schedules, solver jobs, manual edits, messaging) plus orchestration trigger.

### Environments & Base URLs

**Local (Core API + Local Runner)**

- Base URL: `http://localhost:<port>/api/v1/core` (default: `http://localhost:3000/api/v1/core`)
- Orchestration mode: `LOCAL_RUNNER` (default when orchestration env vars are not set)

**AWS (Core API + Step Functions Orchestrator)**

- Base URL: `https://<api-domain>/<stage>/api/v1/core`
- Orchestration mode: `STEP_FUNCTIONS` (when `ORCHESTRATION_MODE` or `MAYWIN_ORCHESTRATION_MODE` is set to `STEP_FUNCTIONS`)
- Step Functions state machine: configured via `SCHEDULE_WORKFLOW_ARN` or `MAYWIN_SFN_ARN`

> All paths in this document are relative to `/api/v1/core`. For example, `GET /health` means `GET http://localhost:3000/api/v1/core/health`.

---

# 2) Authentication

## 2.1 JWT Bearer Auth (required for all endpoints unless stated otherwise)

**Header**

```http
Authorization: Bearer <JWT>
```

**JWT payload** (attached to `req.user` by `JwtStrategy`)

```json
{
  "sub": 123,                // user id (number)
  "organizationId": 10,      // current org id
  "roles": ["NURSE"],       // role codes from unit memberships
  "unitIds": [7, 8]          // unit ids where user has membership
}
```

`sub`, `organizationId`, `roles`, and `unitIds` are used across controllers for authorization decisions.

---

# 3) Conventions

## 3.1 Content Type

- Requests: `application/json`
- Responses: `application/json`

## 3.2 ID formats

- `organizationId`, `siteId`, `unitId`, `workerId`, `scheduleId`, `constraintProfileId` and most other DB ids are **numeric strings** in the API (backed by Postgres `bigint`).  
  Example: `"123"`
- `jobId` is a **UUID string**.  
  Example: `"9e5ebb62-ead9-44c4-8ecf-05c9905b432c"`

## 3.3 Common HTTP status codes

- `200 OK` – successful read / update
- `201 Created` – new resource created
- `400 Bad Request` – validation or malformed input
- `401 Unauthorized` – missing or invalid JWT
- `403 Forbidden` – authenticated but not allowed to access resource
- `404 Not Found` – resource not found or out of scope
- `409 Conflict` – idempotency or unique constraint conflict
- `500 Internal Server Error` – unhandled error on server

## 3.4 Error response (recommended shape)

Nest’s default error shape can vary; for external docs we recommend describing errors in this normalized form:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "dateFrom must be a valid ISO date string",
    "details": {
      "field": "dateFrom"
    }
  }
}
```

Actual runtime errors may include Nest’s `status`, `message`, etc., unless a global filter normalizes them.

---

# 4) Core API

## 4.1 Health

### GET `/health`

**Purpose**: Service liveness check.

**Auth**: Not required.

**Response 200**

```json
{
  "status": "ok",
  "service": "core-backend",
  "version": "1.0.0",
  "time": "2026-01-09T09:00:00.000Z"
}
```

---

## 4.2 Auth

### POST `/auth/login`

**Purpose**: Authenticate a user and return a JWT and basic context.

**Auth**: Not required.

**Request body (`LoginDto`)**

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Response 200**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "fullName": "Nurse One",
    "organizationId": 10,
    "roles": ["NURSE"],
    "unitIds": [7]
  }
}
```

---

### POST `/auth/signup`

**Purpose**: Create a new user under an organization and return JWT.

**Auth**: Typically restricted in production (e.g. to admins); current implementation does not enforce role-based restrictions.

**Request body (`SignupDto`)**

```json
{
  "organizationId": "10",
  "unitId": "7",                 // optional
  "email": "nurse1@hospital.com",
  "password": "StrongPassword123!",
  "fullName": "Nurse One",
  "roleCode": "NURSE",           // optional, default "NURSE" when unitId present
  "attributes": { "phone": "+66..." }
}
```

**Response 201**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "123",
    "email": "nurse1@hospital.com",
    "fullName": "Nurse One",
    "organizationId": 10,
    "roles": ["NURSE"],
    "unitIds": [7]
  }
}
```

**Errors**

- `400` – missing `organizationId` or email already exists.

---

### POST `/auth/logout`

**Purpose**: Placeholder logout; with stateless JWT, client just discards token.

**Auth**: Required.

**Request body (`LogoutDto`)**

```json
{
  "deviceId": "optional-string"
}
```

**Response 200**

```json
{ "ok": true }
```

---

### GET `/auth/me`

**Purpose**: Return the JWT payload attached by `JwtAuthGuard`.

**Auth**: Required.

**Response 200**

```json
{
  "user": {
    "sub": 123,
    "organizationId": 10,
    "roles": ["NURSE"],
    "unitIds": [7]
  }
}
```

---

## 4.3 Organizations

### GET `/organizations/me`

**Purpose**: Fetch the organization associated with the authenticated user.

**Auth**: Required.

**Response 200**

```json
{
  "id": "1",
  "name": "MayWin General Hospital",
  "code": "MAYWIN",
  "timezone": "Asia/Bangkok",
  "attributes": {},
  "created_at": "2026-01-10T00:00:00.000Z",
  "updated_at": "2026-01-10T00:00:00.000Z"
}
```

---

### POST `/organizations`

**Purpose**: Create an organization (bootstrap/admin use).

**Auth**: Required.

**Request body (`CreateOrganizationDto`)**

```json
{
  "name": "MayWin General Hospital",
  "code": "MAYWIN",
  "timezone": "Asia/Bangkok",
  "attributes": {}
}
```

**Response 201**

```json
{
  "id": "1",
  "name": "MayWin General Hospital",
  "code": "MAYWIN",
  "timezone": "Asia/Bangkok",
  "attributes": {},
  "created_at": "2026-01-10T00:00:00.000Z",
  "updated_at": "2026-01-10T00:00:00.000Z"
}
```

---

### PATCH `/organizations/:orgId`

**Purpose**: Update an organization; only allowed if `:orgId` matches `req.user.organizationId`.

**Auth**: Required.

**Request body (`PatchOrganizationDto`)**

```json
{
  "name": "MayWin General Hospital (Updated)",
  "code": "MAYWIN",
  "timezone": "Asia/Bangkok",
  "attributes": {}
}
```

**Response 200**

```json
{
  "id": "1",
  "name": "MayWin General Hospital (Updated)",
  "code": "MAYWIN",
  "timezone": "Asia/Bangkok",
  "attributes": {},
  "created_at": "2026-01-10T00:00:00.000Z",
  "updated_at": "2026-01-12T12:00:00.000Z"
}
```

---

## 4.4 Sites

### GET `/sites`

**Purpose**: List sites for the current organization.

**Auth**: Required.

**Query (`ListSitesQueryDto`)**

- `search?: string`
- `active?: "true" | "false"`
- `limit?: string`
- `offset?: string`
- `sort?: "ASC" | "DESC"`

**Response 200**

```json
{
  "items": [
    {
      "id": "10",
      "organization_id": "1",
      "name": "Main Campus",
      "code": "MAIN",
      "address": "123 Example Rd",
      "timezone": "Asia/Bangkok",
      "attributes": {},
      "is_active": true,
      "created_at": "2026-01-10T00:00:00.000Z"
    }
  ]
}
```

---

### POST `/sites`

**Purpose**: Create a new site under the current organization.

**Auth**: Required.

**Request body (`CreateSiteDto`)**

```json
{
  "organizationId": "1",
  "name": "Main Campus",
  "code": "MAIN",
  "address": "123 Example Rd",
  "timezone": "Asia/Bangkok",
  "attributes": {},
  "isActive": true
}
```

**Response 201**

```json
{
  "id": "10",
  "organization_id": "1",
  "name": "Main Campus",
  "code": "MAIN",
  "address": "123 Example Rd",
  "timezone": "Asia/Bangkok",
  "attributes": {},
  "is_active": true,
  "created_at": "2026-01-10T00:00:00.000Z"
}
```

---

### POST `/sites/:siteId/deactivate`

**Purpose**: Soft-deactivate a site.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "id": "10",
  "is_active": false
}
```

---

## 4.5 Units

### GET `/units`

**Purpose**: List units for the current organization (and optional site).

**Auth**: Required.

**Query (`ListUnitsQueryDto`)**

- `search?: string`
- `siteId?: string`
- `active?: "true" | "false"`
- `limit?: string`
- `offset?: string`
- `sort?: "ASC" | "DESC"`

**Response 200**

```json
{
  "items": [
    {
      "id": "7",
      "organization_id": "1",
      "site_id": "10",
      "name": "ICU",
      "code": "ICU",
      "description": "Intensive Care Unit",
      "attributes": {},
      "is_active": true,
      "created_at": "2026-01-10T00:00:00.000Z",
      "updated_at": "2026-01-10T00:00:00.000Z"
    }
  ]
}
```

---

### GET `/units/:unitId`

**Purpose**: Read unit details.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "id": "7",
  "organization_id": "1",
  "site_id": "10",
  "name": "ICU",
  "code": "ICU",
  "description": "Intensive Care Unit",
  "attributes": {},
  "is_active": true,
  "created_at": "2026-01-10T00:00:00.000Z",
  "updated_at": "2026-01-10T00:00:00.000Z"
}
```

---

### POST `/units`

**Purpose**: Create a unit.

**Auth**: Required.

**Request body (`CreateUnitDto`)**

```json
{
  "organizationId": "1",
  "siteId": "10",
  "name": "Ward A",
  "code": "WARD_A",
  "description": "General ward",
  "attributes": { "floor": 3 },
  "isActive": true
}
```

**Response 201 (example)**

```json
{
  "id": "9",
  "organization_id": "1",
  "site_id": "10",
  "name": "Ward A",
  "code": "WARD_A",
  "description": "General ward",
  "attributes": { "floor": 3 },
  "is_active": true,
  "created_at": "2026-01-10T00:00:00.000Z",
  "updated_at": "2026-01-10T00:00:00.000Z"
}
```

---

### PATCH `/units/:unitId`

**Purpose**: Update a unit’s metadata.

**Auth**: Required.

**Request body (`PatchUnitDto`)**

```json
{
  "name": "ICU - East Wing",
  "code": "ICU_EAST",
  "description": "ICU East Wing",
  "attributes": { "floor": 2 },
  "isActive": true
}
```

**Response 200 (example)**

```json
{
  "id": "7",
  "name": "ICU - East Wing",
  "code": "ICU_EAST",
  "description": "ICU East Wing",
  "attributes": { "floor": 2 },
  "is_active": true
}
```

---

### POST `/units/:unitId/deactivate`

**Purpose**: Soft-deactivate a unit.

**Auth**: Required.

**Response 200**

```json
{
  "id": "7",
  "is_active": false
}
```

---

## 4.6 Roles

### GET `/roles`

**Purpose**: List supported role codes (for UI / validation).

**Auth**: Required.

**Response 200 (example)**

```json
{
  "items": [
    { "code": "ORG_ADMIN", "description": "Organization administrator" },
    { "code": "UNIT_MANAGER", "description": "Unit manager" },
    { "code": "NURSE", "description": "Standard nurse user" }
  ]
}
```

> Actual data comes from the `roles` table; description fields may vary.

---

## 4.7 Schedules

### POST `/units/:unitId/schedules`

**Purpose**: Create a schedule "container" for a unit and date horizon (no solver run yet).

**Auth**: Required.

**Request body (`CreateScheduleDto`)**

```json
{
  "name": "Jan Week 2",
  "startDate": "2026-01-12",
  "endDate": "2026-01-18",
  "constraintProfileId": "15"
}
```

**Response 201 (example)**

```json
{
  "id": "101",
  "unit_id": "7",
  "name": "Jan Week 2",
  "start_date": "2026-01-12",
  "end_date": "2026-01-18",
  "constraint_profile_id": "15",
  "status": "DRAFT",
  "created_by": "123",
  "created_at": "2026-01-09T09:00:00.000Z",
  "attributes": {}
}
```

---

### GET `/units/:unitId/schedules/current?dateFrom=&dateTo=`

**Purpose**: Fetch current schedule + assignments + shift templates for UI.

**Auth**: Required.

**Query (`GetCurrentScheduleQuery`)**

- `dateFrom?: YYYY-MM-DD`
- `dateTo?: YYYY-MM-DD`

**Response 200 (example)**

```json
{
  "schedule": {
    "id": "101",
    "unit_id": "7",
    "name": "Jan Week 2",
    "start_date": "2026-01-12",
    "end_date": "2026-01-18",
    "status": "DRAFT",
    "constraint_profile_id": "15"
  },
  "shiftTemplates": [
    { "id": "1", "code": "DAY", "name": "Day", "start_time": "08:00:00", "end_time": "16:00:00", "is_active": true },
    { "id": "2", "code": "NIGHT", "name": "Night", "start_time": "20:00:00", "end_time": "08:00:00", "is_active": true }
  ],
  "assignments": [
    {
      "id": "9001",
      "schedule_id": "101",
      "worker_id": "200",
      "date": "2026-01-12",
      "shift_code": "DAY",
      "source": "SOLVER",
      "attributes": {},
      "created_at": "2026-01-09T09:05:00.000Z",
      "updated_at": "2026-01-09T09:05:00.000Z"
    }
  ]
}
```

---

### GET `/units/:unitId/schedules/history?limit=10`

**Purpose**: List schedule history for a unit.

**Auth**: Required.

**Query (`GetScheduleHistoryQuery`)**

- `limit?: number` (default 10)

**Response 200 (example)**

```json
{
  "items": [
    { "id": "95", "name": "Dec Week 4", "start_date": "2025-12-22", "end_date": "2025-12-28" },
    { "id": "96", "name": "Dec Week 5", "start_date": "2025-12-29", "end_date": "2026-01-04" }
  ]
}
```

---

### GET `/schedules/:scheduleId`

**Purpose**: Get schedule detail by id (including assignments + templates).

**Auth**: Required.

**Response 200 (example)**

```json
{
  "schedule": { "id": "101", "unit_id": "7", "name": "Jan Week 2", "start_date": "2026-01-12", "end_date": "2026-01-18" },
  "shiftTemplates": [ /* ShiftTemplate[] */ ],
  "assignments": [ /* ScheduleAssignment[] */ ]
}
```

---

### GET `/schedules/:scheduleId/export?format=pdf`

**Purpose**: Export schedule. Phase 1 may return stub; later a signed URL or stream.

**Auth**: Required.

**Query**

- `format?: "pdf" | "csv"` (default `"pdf"`)

**Response 200 (stub example)**

```json
{
  "ok": true,
  "format": "pdf",
  "note": "Export not implemented yet"
}
```

---

## 4.8 Manual Schedule Edit

### PATCH `/schedule-assignments/:assignmentId`

**Purpose**: Manually edit one schedule cell (override solver output).

**Auth**: Required.

**Request body (`PatchAssignmentDto`)**

```json
{
  "workerId": "200",
  "date": "2026-01-12",
  "shiftCode": "NIGHT",
  "attributes": {
    "reason": "Swapped with colleague"
  }
}
```

**Response 200 (example)**

```json
{
  "assignment": {
    "id": "9001",
    "schedule_id": "101",
    "worker_id": "200",
    "date": "2026-01-12",
    "shift_code": "NIGHT",
    "source": "MANUAL",
    "attributes": {
      "reason": "Swapped with colleague"
    },
    "created_at": "2026-01-09T09:05:00.000Z",
    "updated_at": "2026-01-09T09:10:00.000Z"
  }
}
```

---

## 4.9 Jobs (Solver Jobs)

### POST `/schedules/:scheduleId/jobs`

**Purpose**: Request async schedule generation (returns immediately).

**Auth**: Required.

**Headers**

- `idempotency-key` (optional string) – prevents duplicates for the same schedule + payload.

**Request body (`CreateJobDto`)**

```json
{
  "startDate": "2026-01-12",
  "endDate": "2026-01-18",
  "strategy": { "plan": "A", "mode": "strict" },
  "solverConfig": { "timeLimitSeconds": 30 },
  "options": { "dryRun": false },
  "notes": "Run for week 2"
}
```

**Response 201 (example)**

```json
{
  "job": {
    "id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
    "organization_id": "1",
    "unit_id": "7",
    "requested_by": "123",
    "idempotency_key": "schedule-101-2026w2-planA",
    "status": "REQUESTED",
    "start_date": "2026-01-12",
    "end_date": "2026-01-18",
    "chosen_plan": null,
    "final_schedule_id": null,
    "error_code": null,
    "error_message": null,
    "attributes": {},
    "created_at": "2026-01-09T09:20:00.000Z",
    "updated_at": "2026-01-09T09:20:00.000Z"
  }
}
```

---

### GET `/jobs/:jobId`

**Purpose**: Poll job status + phase.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
  "organization_id": "1",
  "unit_id": "7",
  "status": "SOLVING_A_STRICT",
  "start_date": "2026-01-12",
  "end_date": "2026-01-18",
  "chosen_plan": null,
  "final_schedule_id": null,
  "error_code": null,
  "error_message": null,
  "attributes": {
    "phase": "SOLVING_A_STRICT",
    "progressPercent": 55
  },
  "created_at": "2026-01-09T09:20:00.000Z",
  "updated_at": "2026-01-09T09:22:10.000Z"
}
```

---

### GET `/jobs/:jobId/artifacts`

**Purpose**: List job artifacts (normalized input, solver output, KPIs, exports).

**Auth**: Required.

**Response 200 (example)**

```json
{
  "items": [
    {
      "id": "a1",
      "job_id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
      "type": "NORMALIZED_INPUT",
      "storage_provider": "s3",
      "bucket": "maywin-artifacts",
      "object_key": "core/jobs/9e5e.../normalized.json",
      "metadata": {},
      "created_at": "2026-01-09T09:20:10.000Z"
    },
    {
      "id": "a2",
      "job_id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
      "type": "SOLVER_OUTPUT",
      "storage_provider": "s3",
      "bucket": "maywin-artifacts",
      "object_key": "core/jobs/9e5e.../solution.json",
      "metadata": {},
      "created_at": "2026-01-09T09:22:00.000Z"
    }
  ]
}
```

---

### GET `/jobs/:jobId/preview`

**Purpose**: Preview solver results (read-only) for the job.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "jobId": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
  "scheduleId": "101",
  "range": { "startDate": "2026-01-12", "endDate": "2026-01-18" },
  "summary": {
    "score": 1234,
    "violations": []
  },
  "assignments": [
    { "workerId": "200", "date": "2026-01-12", "shiftCode": "DAY" }
  ]
}
```

---

### POST `/jobs/:jobId/apply`

**Purpose**: Apply solver results into the schedule (commit changes).

**Auth**: Required.

**Request body (`ApplyJobDto`)**

```json
{
  "overwriteManualChanges": false
}
```

**Response 200 (example)**

```json
{
  "ok": true,
  "jobId": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
  "scheduleId": "101",
  "applied": {
    "updatedAssignments": 140,
    "skippedManualAssignments": 3
  }
}
```

---

### POST `/jobs/:jobId/cancel`

**Purpose**: Cancel an in-progress job; schedule remains unchanged.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "ok": true,
  "job": {
    "id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
    "status": "FAILED",
    "error_code": "CANCELLED",
    "error_message": "Cancelled by user",
    "updated_at": "2026-01-09T09:25:00.000Z"
  }
}
```

---

## 4.10 Unit Config Bootstrap + CRUD

### GET `/units/:unitId/config`

**Purpose**: One-call bootstrap for scheduling UI (shift templates, constraint profiles, coverage rules).

**Auth**: Required.

**Response 200 (example)**

```json
{
  "shiftTemplates": [ /* ShiftTemplate[] */ ],
  "constraintProfiles": [ /* ConstraintProfile[] */ ],
  "coverageRules": [ /* CoverageRule[] */ ]
}
```

---

### GET `/units/:unitId/shift-templates`

**Purpose**: List shift templates for a unit (unit-specific + org-wide with `unit_id = null`).

**Auth**: Required.

**Response 200 (example)**

```json
{
  "items": [
    {
      "id": "1",
      "organization_id": "1",
      "unit_id": "7",
      "code": "DAY",
      "name": "Day",
      "start_time": "08:00:00",
      "end_time": "16:00:00",
      "attributes": {},
      "is_active": true,
      "created_at": "2026-01-10T00:00:00.000Z"
    }
  ]
}
```

---

### POST `/units/:unitId/shift-templates`

**Purpose**: Create shift template.

**Auth**: Required.

**Request body (`CreateShiftTemplateDto`)**

```json
{
  "code": "EVE",
  "name": "Evening",
  "startTime": "16:00",
  "endTime": "00:00",
  "attributes": { "color": "#FFAA00" },
  "isActive": true
}
```

**Response 201 (example)**

```json
{
  "shiftTemplate": {
    "id": "3",
    "unit_id": "7",
    "code": "EVE",
    "name": "Evening",
    "start_time": "16:00:00",
    "end_time": "00:00:00",
    "is_active": true,
    "attributes": {}
  }
}
```

---

### PATCH `/units/:unitId/shift-templates/:id`

**Purpose**: Update shift template.

**Auth**: Required.

**Request body (`UpdateShiftTemplateDto`)**

```json
{
  "name": "Evening Shift",
  "attributes": { "color": "#FF9900" }
}
```

**Response 200 (example)**

```json
{
  "shiftTemplate": {
    "id": "3",
    "code": "EVE",
    "name": "Evening Shift",
    "start_time": "16:00:00",
    "end_time": "00:00:00",
    "is_active": true,
    "attributes": { "color": "#FF9900" }
  }
}
```

---

### DELETE `/units/:unitId/shift-templates/:id`

**Purpose**: Soft delete (deactivate) shift template.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "ok": true,
  "deactivatedId": "3"
}
```

---

### GET `/units/:unitId/constraint-profiles`

**Purpose**: List constraint profiles for scheduling.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "items": [
    {
      "id": "15",
      "unit_id": "7",
      "name": "Default ICU Policy",
      "is_active": true,
      "max_consecutive_work_days": 5,
      "max_consecutive_night_shifts": 2,
      "min_rest_hours_between_shifts": 12,
      "fairness_weight_json": { "balanceWorkload": 0.5 },
      "penalty_weight_json": { "nightOverCap": 10 }
    }
  ]
}
```

---

### POST `/units/:unitId/constraint-profiles`

**Purpose**: Create constraint profile.

**Auth**: Required.

**Request body (`CreateConstraintProfileDto`)**

```json
{
  "name": "Strict Policy",
  "maxConsecutiveWorkDays": 5,
  "maxConsecutiveNightShifts": 2,
  "minRestHoursBetweenShifts": 12,
  "fairnessWeightJson": { "balanceWorkload": 0.7 },
  "penaltyWeightJson": { "underCoverage": 100 },
  "attributes": { "notes": "For ICU" },
  "isActive": false
}
```

**Response 201 (example)**

```json
{
  "constraintProfile": {
    "id": "16",
    "unit_id": "7",
    "name": "Strict Policy",
    "is_active": false
  }
}
```

---

### PATCH `/units/:unitId/constraint-profiles/:id`

**Purpose**: Update constraint profile.

**Auth**: Required.

**Request body (`UpdateConstraintProfileDto`)**

```json
{
  "isActive": true,
  "penaltyWeightJson": { "underCoverage": 150 }
}
```

**Response 200 (example)**

```json
{
  "constraintProfile": {
    "id": "16",
    "unit_id": "7",
    "name": "Strict Policy",
    "is_active": true
  }
}
```

---

### POST `/units/:unitId/constraint-profiles/:id/activate?deactivateOthers=true`

**Purpose**: Activate a constraint profile; optionally deactivate others.

**Auth**: Required.

**Query**

- `deactivateOthers?: "true" | "false"` (default `true`)

**Response 200 (example)**

```json
{
  "ok": true,
  "activatedId": "16",
  "deactivatedOthers": true
}
```

---

### GET `/units/:unitId/coverage-rules`

**Purpose**: Get coverage rules (min/max staffing per shift/day).

**Auth**: Required.

**Response 200 (example)**

```json
{
  "items": [
    {
      "id": "501",
      "unit_id": "7",
      "shift_code": "DAY",
      "day_type": "WEEKDAY",
      "min_workers": 6,
      "max_workers": 10,
      "required_tag": "ICU",
      "attributes": {}
    }
  ]
}
```

---

### POST `/units/:unitId/coverage-rules`

**Purpose**: Create coverage rule.

**Auth**: Required.

**Request body (`CoverageRuleItemDto`)**

```json
{
  "shiftCode": "DAY",
  "dayType": "WEEKDAY",
  "minWorkers": 6,
  "maxWorkers": 10,
  "requiredTag": "ICU",
  "attributes": { "priority": "HIGH" }
}
```

**Response 201 (example)**

```json
{
  "coverageRule": {
    "id": "502",
    "unit_id": "7",
    "shift_code": "DAY",
    "day_type": "WEEKDAY",
    "min_workers": 6,
    "max_workers": 10,
    "required_tag": "ICU",
    "attributes": { "priority": "HIGH" }
  }
}
```

---

### PATCH `/units/:unitId/coverage-rules/:id`

**Purpose**: Update coverage rule.

**Auth**: Required.

**Request body (`CoverageRuleItemDto`)**

```json
{
  "minWorkers": 7,
  "maxWorkers": 10
}
```

**Response 200 (example)**

```json
{
  "coverageRule": {
    "id": "502",
    "unit_id": "7",
    "min_workers": 7,
    "max_workers": 10
  }
}
```

---

### DELETE `/units/:unitId/coverage-rules/:id`

**Purpose**: Remove coverage rule.

**Auth**: Required.

**Response 200 (example)**

```json
{
  "ok": true,
  "removedId": "502"
}
```

---

### PUT `/units/:unitId/coverage-rules`

**Purpose**: Bulk replace coverage rules.

**Auth**: Required.

**Request body (`ReplaceCoverageRulesDto`)**

```json
{
  "items": [
    { "shiftCode": "DAY", "dayType": "WEEKDAY", "minWorkers": 6, "maxWorkers": 10 },
    { "shiftCode": "NIGHT", "dayType": "WEEKDAY", "minWorkers": 4, "maxWorkers": 7 }
  ]
}
```

**Response 200 (example)**

```json
{
  "ok": true,
  "replacedCount": 2
}
```

---

## 4.11 Workers

### GET `/units/:unitId/workers?search=`

**Purpose**: List workers in a unit (for scheduling UI).

**Auth**: Required.

**Query**

- `search?: string`

**Response 200 (example)**

```json
{
  "items": [
    { "id": "200", "full_name": "Nurse A", "attributes": { "tags": ["ICU"] }, "is_active": true },
    { "id": "201", "full_name": "Nurse B", "attributes": { "tags": ["PEDS"] }, "is_active": true }
  ]
}
```

---

## 4.12 Worker Preferences

### GET `/workers/:workerId/preferences`

**Purpose**: Read worker preferences (UI edit form, solver debug).

**Auth**: Required.

**Response 200 (example)**

```json
{
  "workerId": "200",
  "unitId": "7",
  "preferences": {
    "shiftWeights": [
      { "shiftCode": "DAY", "weight": 10 },
      { "shiftCode": "NIGHT", "weight": -5 }
    ],
    "hardBlockedShiftCodes": ["NIGHT"],
    "maxNightShiftsPerWeek": 1,
    "acceptsOvertime": true,
    "tags": ["ICU"],
    "extra": { "note": "prefers weekends off" }
  },
  "updatedAt": "2026-01-09T09:30:00.000Z"
}
```

---

### PUT `/workers/:workerId/preferences`

**Purpose**: Upsert worker preferences.

**Auth**: Required.

**Request body (`PutWorkerPreferencesDto`)**

```json
{
  "unitId": "7",
  "preferences": {
    "shiftWeights": [
      { "shiftCode": "DAY", "weight": 10 },
      { "shiftCode": "NIGHT", "weight": -10 }
    ],
    "hardBlockedShiftCodes": ["NIGHT"],
    "maxNightShiftsPerWeek": 1,
    "acceptsOvertime": false,
    "tags": ["ICU"],
    "extra": { "notes": "Exam week" }
  }
}
```

**Response 200 (example)**

```json
{
  "ok": true,
  "workerId": "200",
  "unitId": "7"
}
```

---

## 4.13 Availability

### GET `/units/:unitId/availability?dateFrom=&dateTo=`

**Purpose**: Fetch availability entries for a unit in a date range.

**Auth**: Required.

**Query (`GetAvailabilityQuery`)**

- `dateFrom: YYYY-MM-DD`
- `dateTo: YYYY-MM-DD`

**Response 200 (example)**

```json
{
  "unitId": "7",
  "dateFrom": "2026-01-12",
  "dateTo": "2026-01-18",
  "entries": [
    {
      "workerId": "200",
      "date": "2026-01-13",
      "shiftCode": "DAY",
      "type": "UNAVAILABLE",
      "source": "MANAGER",
      "reason": "Training",
      "attributes": {}
    }
  ]
}
```

---

### PUT `/units/:unitId/availability`

**Purpose**: Bulk upsert availability entries.

**Auth**: Required.

**Request body (`PutAvailabilityDto`)**

```json
{
  "entries": [
    {
      "workerId": "200",
      "date": "2026-01-13",
      "shiftCode": "DAY",
      "type": "UNAVAILABLE",
      "source": "MANAGER",
      "reason": "Training",
      "attributes": { "ticket": "HR-22" }
    }
  ]
}
```

**Response 200 (example)**

```json
{
  "ok": true,
  "upserted": 1
}
```

---

## 4.14 Worker Messages (Inbox-style)

### POST `/workers/:workerId/messages`

**Purpose**: Create a message for a worker (nurse inbox).

**Auth**: Required.

**Request body (`CreateWorkerMessageDto`)**

```json
{
  "direction": "OUTBOUND",
  "status": "SENT",
  "subject": "Schedule Updated",
  "body": "Your shift on Jan 13 was changed to NIGHT.",
  "jobId": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
  "scheduleId": "101",
  "shiftDate": "2026-01-13",
  "shiftCode": "NIGHT",
  "attributes": { "severity": "INFO" }
}
```

**Response 201 (example)**

```json
{
  "message": {
    "id": "7001",
    "worker_id": "200",
    "direction": "OUTBOUND",
    "status": "SENT",
    "subject": "Schedule Updated",
    "body": "Your shift on Jan 13 was changed to NIGHT.",
    "job_id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
    "schedule_id": "101",
    "shift_date": "2026-01-13",
    "shift_code": "NIGHT",
    "attributes": { "severity": "INFO" },
    "created_at": "2026-01-09T09:35:00.000Z",
    "updated_at": "2026-01-09T09:35:00.000Z"
  }
}
```

---

### POST `/workers/:workerId/messages/chat`

**Purpose**: Create a simple chat-style message (short body + optional subject).

**Auth**: Required.

**Request body (`CreateWorkerChatMessageDto`)**

```json
{
  "body": "Chat-style message (max 5000 chars)",
  "subject": "optional subject (max 200 chars)"
}
```

**Response 201** – same `WorkerMessage` shape as above.

---

### GET `/workers/:workerId/messages?limit=&offset=&sort=`

**Purpose**: List messages for a worker.

**Auth**: Required.

**Query (`ListWorkerMessagesQueryDto`)**

- `unitId?: string`
- `jobId?: uuid`
- `status?: "SENT" | "DELIVERED" | "READ" | "ARCHIVED"`
- `direction?: "INBOUND" | "OUTBOUND"`
- `limit?: string`
- `offset?: string`
- `sort?: "ASC" | "DESC"`

**Response 200 (example)**

```json
{
  "items": [
    {
      "id": "7001",
      "worker_id": "200",
      "direction": "OUTBOUND",
      "status": "SENT",
      "subject": "Schedule Updated",
      "body": "Your shift on Jan 13 was changed to NIGHT.",
      "created_at": "2026-01-09T09:35:00.000Z"
    }
  ],
  "meta": { "limit": 50, "offset": 0, "sort": "DESC" }
}
```

---

### GET `/units/:unitId/messages`

**Purpose**: Manager inbox – list messages by unit.

**Auth**: Required.

**Query**

Same as `ListWorkerMessagesQueryDto` (without `unitId` in query).

**Response 200** – same paginated structure as worker messages.

---

### GET `/jobs/:jobId/messages`

**Purpose**: List messages linked to a solver job.

**Auth**: Required.

**Query**

Same as `ListWorkerMessagesQueryDto`.

**Response 200** – same paginated structure as worker messages.

---

## 4.15 Orchestrator (Local / AWS)

### Modes & Environment

The orchestrator endpoint always **creates a job** first, then:

- If mode is `LOCAL_RUNNER` → enqueues a local runner and returns immediately.
- If mode is `STEP_FUNCTIONS` → starts AWS Step Functions execution and returns execution info.

Environment variables (as implemented):

- `ORCHESTRATION_MODE` or `MAYWIN_ORCHESTRATION_MODE`
  - `STEP_FUNCTIONS` or `LOCAL_RUNNER` (default `LOCAL_RUNNER`)
- `SCHEDULE_WORKFLOW_ARN` or `MAYWIN_SFN_ARN`
  - state machine ARN (with some auto-fix logic for `aws:states:` / `states:` prefixes).

---

### POST `/orchestrator/run`

**Purpose**: Create a scheduling job and start orchestration (local runner or Step Functions).

**Auth**: Required.

**Request body (`RunOrchestratorDto`)**

```json
{
  "scheduleId": "101",
  "idempotencyKey": "schedule-101-2026w2-planA",
  "dto": {
    "startDate": "2026-01-12T00:00:00.000Z",
    "endDate": "2026-01-18T00:00:00.000Z",
    "strategy": { "plan": "A", "mode": "strict" },
    "solverConfig": { "timeLimitSeconds": 30 },
    "options": { "dryRun": false },
    "notes": "Run with Step Functions"
  }
}
```

**Response 200 – LOCAL_RUNNER mode**

```json
{
  "ok": true,
  "mode": "LOCAL_RUNNER",
  "job": {
    "id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
    "schedule_id": "101",
    "status": "REQUESTED",
    "created_at": "2026-01-09T09:40:00.000Z"
  }
}
```

**Response 200 – STEP_FUNCTIONS mode (success)**

```json
{
  "ok": true,
  "mode": "STEP_FUNCTIONS",
  "job": {
    "id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
    "schedule_id": "101",
    "status": "REQUESTED",
    "created_at": "2026-01-09T09:40:00.000Z"
  },
  "execution": {
    "arn": "arn:aws:states:ap-southeast-1:123456789012:execution:maywin-schedule-workflow:job-...",
    "startDate": "2026-01-09T09:40:01.000Z",
    "name": "job-9e5ebb62-ead9-44c4-8ecf-05c9905b432c-1767865994124",
    "stateMachineArn": "arn:aws:states:ap-southeast-1:123456789012:stateMachine:maywin-schedule-workflow"
  }
}
```

**Response 200 – STEP_FUNCTIONS mode (StartExecution failed)**

```json
{
  "ok": false,
  "mode": "STEP_FUNCTIONS",
  "job": {
    "id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
    "schedule_id": "101",
    "status": "REQUESTED",
    "created_at": "2026-01-09T09:40:00.000Z"
  },
  "error": {
    "name": "StartExecutionError",
    "message": "Missing required permission states:StartExecution"
  }
}
```

---

# 5) Endpoint Index (Quick List)

**Health**

- `GET /health`

**Auth**

- `POST /auth/login`
- `POST /auth/signup`
- `POST /auth/logout`
- `GET /auth/me`

**Organizations**

- `GET /organizations/me`
- `POST /organizations`
- `PATCH /organizations/:orgId`

**Sites**

- `GET /sites`
- `POST /sites`
- `POST /sites/:siteId/deactivate`

**Units**

- `GET /units`
- `GET /units/:unitId`
- `POST /units`
- `PATCH /units/:unitId`
- `POST /units/:unitId/deactivate`

**Roles**

- `GET /roles`

**Workers**

- `GET /units/:unitId/workers`

**Worker Preferences**

- `GET /workers/:workerId/preferences`
- `PUT /workers/:workerId/preferences`

**Availability**

- `GET /units/:unitId/availability`
- `PUT /units/:unitId/availability`

**Schedules**

- `POST /units/:unitId/schedules`
- `GET /units/:unitId/schedules/current`
- `GET /units/:unitId/schedules/history`
- `GET /schedules/:scheduleId`
- `GET /schedules/:scheduleId/export`
- `PATCH /schedule-assignments/:assignmentId`

**Jobs (Solver Runs)**

- `POST /schedules/:scheduleId/jobs`
- `GET /jobs/:jobId`
- `GET /jobs/:jobId/artifacts`
- `GET /jobs/:jobId/preview`
- `POST /jobs/:jobId/apply`
- `POST /jobs/:jobId/cancel`

**Unit Configuration**

- `GET /units/:unitId/config`
- `GET /units/:unitId/shift-templates`
- `POST /units/:unitId/shift-templates`
- `PATCH /units/:unitId/shift-templates/:id`
- `DELETE /units/:unitId/shift-templates/:id`
- `GET /units/:unitId/constraint-profiles`
- `POST /units/:unitId/constraint-profiles`
- `PATCH /units/:unitId/constraint-profiles/:id`
- `POST /units/:unitId/constraint-profiles/:id/activate`
- `GET /units/:unitId/coverage-rules`
- `POST /units/:unitId/coverage-rules`
- `PATCH /units/:unitId/coverage-rules/:id`
- `DELETE /units/:unitId/coverage-rules/:id`
- `PUT /units/:unitId/coverage-rules`

**Messages**

- `POST /workers/:workerId/messages`
- `POST /workers/:workerId/messages/chat`
- `GET /workers/:workerId/messages`
- `GET /units/:unitId/messages`
- `GET /jobs/:jobId/messages`

**Orchestration**

- `POST /orchestrator/run`
