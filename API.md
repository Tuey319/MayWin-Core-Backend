# API Documentation

This covers the backend Lambda that the Next.js BFF talks to, and the BFF routes themselves.

---

## Backend Lambda

Base URL:
```
https://rf5wup7oy5ng7h5soteik7ajpe0iunpn.lambda-url.ap-southeast-1.on.aws/api/v1/core
```

All requests require an `Authorization: Bearer <token>` header. The BFF handles this automatically — it logs in once on startup and caches the token in memory.

---

## Auth

All auth endpoints support 2FA via OTP (One-Time Password) sent to the user's email.

### `POST /auth/login`

Step 1: Validate email and password credentials. If valid, generates and sends a 6-digit OTP to the user's email.

**Request**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response — 200 OK**
```json
{
  "requires2FA": true,
  "otpToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Notes:**
- `otpToken` is a short-lived token (expires in 10 minutes) that flags the password as verified
- User must provide this `otpToken` + OTP code to the `/auth/verify-otp` endpoint
- In development without SMTP: OTP is printed to console for testing

**Errors**
- `401` — Invalid email or password

---

### `POST /auth/verify-otp`

Step 2: Validate the OTP code sent to user's email + the pending token from `/auth/login`. Returns the real JWT access token.

**Request**
```json
{
  "otpToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "otp": "123456"
}
```

**Response — 200 OK**
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": "42",
    "email": "user@example.com",
    "fullName": "John Doe",
    "organizationId": 1,
    "roles": ["NURSE", "UNIT_MANAGER"],
    "unitIds": [2, 3]
  }
}
```

**Errors**
- `401` — Invalid/expired otpToken, no pending verification, expired OTP, or incorrect OTP code

---

### `POST /auth/signup`

Register a new user account.

**Request**
```json
{
  "organizationId": "1",
  "unitId": "2",
  "email": "newuser@example.com",
  "password": "securepassword",
  "fullName": "Jane Smith",
  "roleCode": "NURSE",
  "attributes": {}
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `organizationId` | numeric string | yes | Organization ID |
| `unitId` | numeric string | no | Unit ID (if assigning to a unit immediately) |
| `email` | string | yes | Valid email address |
| `password` | string | yes | Minimum 6 characters |
| `fullName` | string | yes | User's full name |
| `roleCode` | string | no | Default: "NURSE" |
| `attributes` | object | no | Custom attributes |

**Response — 200 OK**
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": "43",
    "email": "newuser@example.com",
    "fullName": "Jane Smith",
    "organizationId": 1,
    "roles": ["NURSE"],
    "unitIds": [2]
  }
}
```

**Errors**
- `400` — Email already exists, organizationId required, or validation errors

---

### `POST /auth/logout`

Logout the current user. Requires JWT authentication.

Auth: JWT required (`Authorization: Bearer <token>`)

**Request**
```json
{
  "deviceId": "device123"
}
```

**Response — 200 OK**
```json
{
  "ok": true
}
```

---

### `GET /auth/me`

Get the currently authenticated user's profile.

Auth: JWT required (`Authorization: Bearer <token>`)

**Response — 200 OK**
```json
{
  "user": {
    "id": "42",
    "email": "user@example.com",
    "fullName": "John Doe",
    "organizationId": 1,
    "roles": ["NURSE", "UNIT_MANAGER"],
    "unitIds": [2, 3]
  }
}
```

**Errors**
- `401` — Missing or invalid JWT token

---

## Schedule

### `POST /units/:unitId/schedules`

Creates a new schedule container for a unit. This does **not** run the solver — it just creates the schedule record. Use the solver endpoint afterward to generate assignments.

Auth: JWT required (`Authorization: Bearer <token>`)

**Request**
```json
{
  "name": "March 2025",
  "startDate": "2025-03-01",
  "endDate": "2025-03-31",
  "constraintProfileId": "1"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Human-readable label |
| `startDate` | ISO date string | yes | e.g. `"2025-03-01"` |
| `endDate` | ISO date string | yes | e.g. `"2025-03-31"` |
| `constraintProfileId` | numeric string | no | Links to a constraint profile |

**Response — 201 Created**
```json
{
  "schedule": {
    "id": "42",
    "organizationId": "1",
    "unitId": "2",
    "name": "March 2025",
    "startDate": "2025-03-01",
    "endDate": "2025-03-31",
    "status": "DRAFT",
    "constraintProfileId": "1",
    "jobId": null,
    "createdAt": "2025-03-01T00:00:00.000Z"
  }
}
```

**Errors**
- `400` — missing/invalid fields, or invalid authenticated user id
- `401` — missing or unrecognized JWT user
- `404` — unit not found

---

### `GET /schedule?unitId=2`

Used by: `src/app/api/schedule/route.js`

Returns the current generated schedule for unit 2.

**Expected response shape (abbreviated)**
```json
{
  "success": true,
  "result": {
    "assignments": [
      { "workerId": "42", "date": "2025-03-01", "shiftCode": "M" },
      { "workerId": "42", "date": "2025-03-02", "shiftCode": "N" }
    ]
  }
}
```

**Shift codes**

| Code | Meaning |
|---|---|
| `M` or `morning` or `d` | Morning shift |
| `A` or `evening` or `e` | Evening shift |
| `N` or `night` or `n` | Night shift |
| `off` | Day off |

---

## Nurse export

### `GET /nurses/export` (or similar)

Used by: `src/app/api/export/route.js`

Returns nurse details to enrich the schedule table plus a top-level overall satisfaction KPI.

**Expected response shape**
```json
{
  "overallAverageSatisfaction": 0.7345,
  "nurses": [
    {
      "id": 42,
      "name": "Nurse A",
      "level": null,
      "employment_type": "FULL_TIME",
      "unit": "2"
    }
  ]
}
```

Notes:
- `overallAverageSatisfaction` is returned at top-level (not per nurse row).
- Nurse rows no longer include `satisfaction` / `averageSatisfaction` fields.
- Value may be `null` if no usable KPI source exists for the unit.

---

## Dashboard KPI Summary

### `GET /units/:unitId/kpis/summary`

Purpose: Return donut-ready KPI metrics for dashboard cards.

Used for:
- Average satisfaction donut
- Fairness distribution donut (`workloadStdDev`)

Optional query params:
- `startDate` (YYYY-MM-DD)
- `endDate` (YYYY-MM-DD)

Example:
`GET /units/2/kpis/summary?startDate=2026-03-09&endDate=2026-03-15`

**Response**
```json
{
  "schema": "DashboardKpi.v1",
  "unitId": "2",
  "source": "s3_kpi",
  "window": {
    "startDate": "2026-03-09",
    "endDate": "2026-03-15"
  },
  "metrics": {
    "satisfaction": {
      "average": 0.8231
    },
    "fairness": {
      "workloadStdDev": 0.718795,
      "workloadMin": 23,
      "workloadMax": 26,
      "workerCount": 30
    }
  }
}
```

`source` can be one of:
- `artifact_metadata`
- `s3_kpi`
- `solver_runs`
- `latest_schedule_run`
- `none`

---

## Worker Preferences

### `GET /units/:unitId/workers/preferences`

Used by: `src/app/api/preferences/route.js`

Returns shift preferences for all workers in a unit.

**Example:** `GET /units/2/workers/preferences`

**Expected response shape**
```json
{
  "workerPreferences": {
    "items": [
      {
        "worker": {
          "id": 42,
          "fullName": "Nurse A",
          "workerCode": "N042",
          "attributes": { "skill": "RN" },
          "employmentType": "full-time"
        },
        "preferences": {
          "id": "pref-1",
          "preference_pattern_json": {
            "2025-03-01": { "morning": 9, "night": 3 },
            "2025-03-02": { "evening": 7 }
          }
        }
      }
    ]
  }
}
```

### `DELETE /workers/:workerId/preferences`

Deletes all preferences for a worker.

**Example:** `DELETE /workers/42/preferences`

**Response**
```json
{
  "workerId": "42",
  "deleted": true
}
```

**Errors**
- `404` – worker not found or no preferences row exists.

### `DELETE /workers/:workerId/preferences/requests/:date`

Removes a single date entry from a worker's `preference_pattern_json` (reject one nurse request).

**Example:** `DELETE /workers/42/preferences/requests/2026-03-01`

**Response**
```json
{
  "workerId": "42",
  "deletedDate": "2026-03-01",
  "remaining": 2
}
```

**Errors**
- `404` – worker not found, no preferences row, or no entry for that date.

### `DELETE /workers/:workerId/preferences/days-off/:date`

Rejects one day-off request date.

This removes the date from:
- `worker_preferences.days_off_pattern_json` (if present), and
- `worker_availability` rows where `type = DAY_OFF` for that worker/date.

**Example:** `DELETE /workers/42/preferences/days-off/2026-03-01`

**Response**
```json
{
  "workerId": "42",
  "deletedDate": "2026-03-01",
  "removedFromDaysOffPattern": true,
  "removedAvailabilityRows": 1,
  "remainingPatternDaysOffCount": 3
}
```

**Errors**
- `404` – worker not found or no day-off entry found for that date in either source.

---

## Solver (schedule generation)

### `POST /orchestrator/run`

Used by: `src/app/api/solver/route.js` (POST handler)

Kicks off an async schedule solve. Returns immediately with a job ID.

**Request**
```json
{
  "scheduleId": "2",
  "idempotencyKey": "schedule-1234567890-abc123",
  "dto": {
    "startDate": "2025-03-01T00:00:00.000Z",
    "endDate": "2025-03-31T23:59:59.999Z",
    "strategy": { "plan": "A", "mode": "strict" },
    "solverConfig": { "timeLimitSeconds": 120 },
    "options": { "dryRun": false },
    "notes": "30 nurses - 30 day schedule with realistic constraints"
  }
}
```

> `dto.length` (number of days) can be provided instead of `dto.endDate`. The backend will compute `endDate` as `startDate + (length - 1)` days, end-of-day UTC.

**Response — `LOCAL_RUNNER` mode** (default)
```json
{
  "ok": true,
  "mode": "LOCAL_RUNNER",
  "jobId": "job-uuid-here",
  "executionArn": null,
  "job": {
    "id": "job-uuid-here",
    "scheduleId": "2",
    "state": "REQUESTED",
    "createdAt": "2025-03-01T00:00:00.000Z"
  }
}
```

**Response — `STEP_FUNCTIONS` mode** (when `ORCHESTRATION_MODE=STEP_FUNCTIONS`)
```json
{
  "ok": true,
  "mode": "STEP_FUNCTIONS",
  "jobId": "job-uuid-here",
  "executionArn": "arn:aws:states:...",
  "job": {
    "id": "job-uuid-here",
    "scheduleId": "2",
    "state": "REQUESTED",
    "createdAt": "2025-03-01T00:00:00.000Z"
  },
  "execution": {
    "arn": "arn:aws:states:...",
    "startDate": "2025-03-01T00:00:00.000Z",
    "name": "job-<uuid>-<timestamp>",
    "stateMachineArn": "arn:aws:states:..."
  }
}
```

If Step Functions fails to start, `ok` will be `false` and an `error` object (`name`, `message`) is returned instead of `execution`.

---

### `GET /schedule-jobs/:jobId`

Used by: `src/app/api/solver/route.js` (GET handler, polled every 4s)

**Response**
```json
{
  "job": {
    "id": "job-uuid-here",
    "scheduleId": "2",
    "state": "COMPLETED",
    "phase": "COMPLETED",
    "createdAt": "2025-03-01T00:00:00.000Z",
    "updatedAt": "2025-03-01T00:30:00.000Z",
    "errorCode": null,
    "errorMessage": null
  }
}
```

**Job states** (`state` field) — all uppercase:

| State | `phase` value | Meaning |
|---|---|---|
| `REQUESTED` | `REQUESTED` | Job created, not yet started |
| `VALIDATED` | `VALIDATING` | Input validation passed |
| `NORMALIZING` | `NORMALIZING` | Converting input data |
| `SOLVING_A_STRICT` | `STRICT_PASS` | Running strict solver plan |
| `SOLVING_A_RELAXED` | `RELAXED_PASS` | Running relaxed solver plan |
| `SOLVING_B_MILP` | `MILP_FALLBACK` | Running MILP fallback solver |
| `EVALUATING` | `EVALUATING` | Evaluating solver results |
| `PERSISTING` | `PERSISTING` | Writing results to database |
| `COMPLETED` | `COMPLETED` | Terminal — success |
| `FAILED` | `FAILED` | Terminal — failed (see `errorCode`/`errorMessage`) |

The BFF polls until `state === 'COMPLETED'` (success) or `state === 'FAILED'` (failure), or until the 3-minute timeout is reached.

---

## BFF routes summary

These are the Next.js API routes in `src/app/api/` that the browser talks to. They proxy to the Lambda and handle auth tokens server-side.

| Method | BFF route | Proxies to |
|---|---|---|
| `POST` | `/api/auth/login` | `/auth/login` |
| `POST` | `/api/auth/verify-otp` | `/auth/verify-otp` |
| `POST` | `/api/auth/logout` | (clears cookie, no backend call) |
| `GET` | `/api/auth/me` | (reads cookie, no backend call) |
| `GET` | `/api/schedule` | `/schedule?unitId=2` |
| `GET` | `/api/export` | `/nurses/export` |
| `GET` | `/api/preferences?unitId=` | `/units/:id/workers/preferences` |
| `POST` | `/api/solver` | `/orchestrator/run` |
| `GET` | `/api/solver?jobId=` | `/schedule-jobs/:id` |
| `GET` | `/api/staff` | `/staff` |
| `POST` | `/api/staff` | `/staff` |
| `GET` | `/api/staff/:id` | `/staff/:id` |
| `PATCH` | `/api/staff/:id` | `/staff/:id` |
| `DELETE` | `/api/staff/:id` | `/staff/:id` |
| `GET` | `/api/audit-logs` | `/audit-logs` |
| `GET` | `/api/audit-logs?export=csv` | `/audit-logs?export=csv` |
| `POST` | `/api/audit-logs` | `/audit-logs` |
| `GET` | `/api/hospital` | `GET /organizations` → `GET /organizations/:id` → `GET /units` → session fallback |
| `PUT` | `/api/hospital` | `PUT /organizations` |
| `GET` | `/api/hospital/containers` | `GET /organizations/:orgId/schedule-containers` |
| `POST` | `/api/hospital/containers` | `POST /organizations/:orgId/schedule-containers` |
| `PUT` | `/api/hospital/containers/:id` | `PUT /organizations/:orgId/schedule-containers/:id` |
| `DELETE` | `/api/hospital/containers/:id` | `DELETE /organizations/:orgId/schedule-containers/:id` |
| `GET` | `/api/hospital/profiles` | `GET /organizations/:orgId/constraint-profiles` |
| `POST` | `/api/hospital/profiles` | `POST /organizations/:orgId/constraint-profiles` |
| `PUT` | `/api/hospital/profiles/:id` | `PUT /organizations/:orgId/constraint-profiles/:id` |
| `DELETE` | `/api/hospital/profiles/:id` | `DELETE /organizations/:orgId/constraint-profiles/:id` |

---

## Hospital Organisation

These endpoints are used by the BFF routes under `src/app/api/hospital/` to fetch and save the organisation tree, schedule containers, and constraint profiles.

> **Backend status:** Organisation tree endpoints may not exist yet on the Lambda — the BFF falls back gracefully. Schedule container and constraint profile endpoints are designed below and pending backend implementation; the frontend uses `localStorage` as a write-through cache in the meantime.

### `GET /organizations`

Returns all organizations the authenticated user belongs to.

Auth: JWT required (`Authorization: Bearer <token>`)

**Response — 200 OK**
```json
{
  "organizations": [
    {
      "id": "1",
      "name": "Bangkok Hospital",
      "code": "BKK",
      "sites": [
        {
          "id": "site-1",
          "name": "Main Campus",
          "code": "MAIN",
          "departments": [
            { "id": "dept-1", "name": "Surgery", "code": "SURG" }
          ]
        }
      ]
    }
  ]
}
```

The BFF also accepts `{ "data": [...] }` as the top-level wrapper in place of `"organizations"`.

**Errors**
- `401` — missing or invalid JWT

---

### `GET /organizations/:orgId`

Returns a single organization by ID. Used as a fallback when `GET /organizations` is unavailable.

Auth: JWT required (`Authorization: Bearer <token>`)

**Response — 200 OK**
```json
{
  "organization": {
    "id": "1",
    "name": "Bangkok Hospital",
    "code": "BKK",
    "sites": [...]
  }
}
```

The BFF also accepts `{ "data": { ... } }` as the wrapper in place of `"organization"`.

**Errors**
- `401` — missing or invalid JWT
- `404` — organization not found

---

### `GET /units`

Returns all units (departments) the user has access to. Used as a second fallback when the organization endpoints above are unavailable — the BFF maps units to a single synthetic site under the session `organizationId`.

Auth: JWT required (`Authorization: Bearer <token>`)

**Query params** (all optional)

| Param | Type | Notes |
|---|---|---|
| `search` | string | Filter by name/code |
| `siteId` | numeric string | Filter by site |
| `active` | `"true"` \| `"false"` | Filter by active status |
| `limit` | numeric string | Page size |
| `offset` | numeric string | Page offset |
| `sort` | `"ASC"` \| `"DESC"` | Sort order |

**Response — 200 OK**
```json
{
  "units": [
    { "id": "2", "name": "ICU", "code": "ICU", "organizationId": "1", "siteId": null, "description": null, "isActive": true, "attributes": {} },
    { "id": "3", "name": "Surgery", "code": "SURG", "organizationId": "1", "siteId": null, "description": null, "isActive": true, "attributes": {} }
  ]
}
```

The BFF also accepts `{ "data": [...] }` or a bare array.

**Errors**
- `401` — missing or invalid JWT

---

### `GET /units/:unitId`

Returns a single unit by ID.

Auth: JWT required

**Response — 200 OK**
```json
{
  "unit": { "id": "2", "name": "ICU", "code": "ICU", "organizationId": "1", "siteId": null, "description": null, "isActive": true, "attributes": {} }
}
```

**Errors**
- `401` — missing or invalid JWT
- `404` — unit not found

---

### `POST /units`

Creates a new unit.

Auth: JWT required

**Request**
```json
{
  "organizationId": "1",
  "name": "ICU",
  "code": "ICU",
  "siteId": null,
  "description": "Intensive Care Unit",
  "attributes": {},
  "isActive": true
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `organizationId` | numeric string | yes | Parent organization |
| `name` | string | yes | Unit display name |
| `code` | string | yes | Short code (e.g. `"ICU"`) |
| `siteId` | numeric string \| null | no | Parent site if applicable |
| `description` | string \| null | no | Free-text description |
| `attributes` | object | no | Custom key-value metadata |
| `isActive` | boolean | no | Default: `true` |

**Response — 201 Created**
```json
{
  "unit": { "id": "4", "name": "ICU", "code": "ICU", "organizationId": "1", ... }
}
```

**Errors**
- `400` — missing required fields
- `401` — missing or invalid JWT

---

### `PATCH /units/:unitId`

Updates any subset of fields on a unit.

Auth: JWT required

**Request** — all fields optional (same as POST minus `organizationId`)

**Response — 200 OK**
```json
{
  "unit": { "id": "2", "name": "ICU Updated", ... }
}
```

**Errors**
- `401` — missing or invalid JWT
- `404` — unit not found

---

### `POST /units/:unitId/deactivate`

Soft-deactivates a unit (sets `isActive = false`).

Auth: JWT required

**Response — 200 OK**
```json
{ "ok": true }
```

**Errors**
- `401` — missing or invalid JWT
- `404` — unit not found

---

### `GET /units/:unitId/members`

Lists all members of a unit.

Auth: JWT required

**Response — 200 OK**
```json
{
  "members": [
    { "id": "1", "userId": "42", "unitId": "2", "roleCode": "NURSE", "createdAt": "2026-01-01T00:00:00.000Z" }
  ]
}
```

**Errors**
- `401` — missing or invalid JWT
- `404` — unit not found

---

### `POST /units/:unitId/members`

Adds a user to a unit.

Auth: JWT required

**Request**
```json
{
  "userId": "42",
  "roleCode": "NURSE"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | numeric string | yes | ID of the user to add |
| `roleCode` | string | no | Default: `"NURSE"` |

**Response — 201 Created**
```json
{
  "member": { "id": "1", "userId": "42", "unitId": "2", "roleCode": "NURSE", "createdAt": "2026-01-01T00:00:00.000Z" }
}
```

**Errors**
- `401` — missing or invalid JWT
- `404` — unit not found
- `409` — user is already a member of this unit

---

### `DELETE /units/:unitId/members/:userId`

Removes a user from a unit.

Auth: JWT required

**Response — 200 OK**
```json
{ "ok": true }
```

**Errors**
- `401` — missing or invalid JWT
- `404` — unit or membership not found

---

### `PUT /organizations`

Saves the full organisation tree (all organizations, sites, departments). The BFF sends the client's current `data` array as the request body.

Auth: JWT required (`Authorization: Bearer <token>`)

**Request** — the full organization array as returned by `GET /organizations`
```json
{
  "organizations": [
    {
      "id": "1",
      "name": "Bangkok Hospital",
      "code": "BKK",
      "sites": [
        {
          "id": "site-1",
          "name": "Main Campus",
          "code": "MAIN",
          "departments": [
            { "id": "dept-1", "name": "Surgery", "code": "SURG" }
          ]
        }
      ]
    }
  ]
}
```

**Response — 200 OK**
```json
{ "ok": true }
```

**Notes**
- If the backend does not yet support this endpoint the BFF responds with `{ "ok": true, "saved": false, "message": "Saved locally (backend sync pending)" }` instead of returning an error.

**Errors**
- `400` — malformed body
- `401` — missing or invalid JWT

---

### `GET /organizations/:orgId/schedule-containers`

Returns all schedule containers (scheduling periods) for the given organization.

Auth: JWT required

**Response — 200 OK**
```json
{
  "containers": [
    {
      "id": "c-1",
      "name": "May 2025",
      "site": "Main Campus",
      "dept": "ICU",
      "start": "2025-05-01",
      "end": "2025-05-31",
      "status": "active",
      "notes": "Covers long weekend",
      "profileId": "p-1"
    }
  ]
}
```

The BFF also accepts `{ "data": [...] }` or a bare array.

**Errors**
- `401` — missing or invalid JWT
- `404` — organization not found

---

### `POST /organizations/:orgId/schedule-containers`

Creates a new schedule container.

Auth: JWT required

**Request**
```json
{
  "name": "May 2025",
  "site": "Main Campus",
  "dept": "ICU",
  "start": "2025-05-01",
  "end": "2025-05-31",
  "status": "draft",
  "notes": "",
  "profileId": "p-1"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Human-readable label |
| `site` | string | no | Site name (display only) |
| `dept` | string | no | Department name (display only) |
| `start` | ISO date string (`YYYY-MM-DD`) | yes | Period start |
| `end` | ISO date string (`YYYY-MM-DD`) | yes | Period end |
| `status` | `"draft"` \| `"active"` \| `"archived"` | no | Default: `"draft"` |
| `notes` | string | no | Free-text notes |
| `profileId` | string | no | ID of the linked constraint profile |

**Response — 201 Created**
```json
{
  "container": {
    "id": "c-123",
    "name": "May 2025",
    ...
  }
}
```

**Errors**
- `400` — missing required fields
- `401` — missing or invalid JWT

---

### `PUT /organizations/:orgId/schedule-containers/:id`

Updates an existing schedule container. All fields are optional — only provided fields are updated.

Auth: JWT required

**Request** — same shape as POST, all fields optional.

**Response — 200 OK**
```json
{ "container": { "id": "c-123", ... } }
```

**Errors**
- `401` — missing or invalid JWT
- `404` — container not found

---

### `DELETE /organizations/:orgId/schedule-containers/:id`

Permanently deletes a schedule container.

Auth: JWT required

**Response — 200 OK**
```json
{ "ok": true }
```

**Errors**
- `401` — missing or invalid JWT
- `404` — container not found

---

### Constraint Profiles

Constraint profiles are a unified concept — every profile has UI display fields (`description`, `color`, `assignedTo`) and solver fields (`maxConsecutiveWorkDays`, `forbidNightToMorning`, etc.) in one model. What the user configures on the constraint profile page is exactly what the solver uses. Profiles are scoped to either an **org** (`orgId` set) or a **unit** (`unitId` set).

All profile endpoints return the same shape:

```json
{
  "id": "1",
  "unitId": null,
  "orgId": "1",
  "name": "ICU Standard",
  "description": "Standard ICU shift rules",
  "assignedTo": "ICU",
  "color": "primary",
  "maxConsecutiveWorkDays": 5,
  "maxConsecutiveNightShifts": 2,
  "minRestHoursBetweenShifts": 11,
  "maxShiftsPerDay": 1,
  "minDaysOffPerWeek": 2,
  "maxNightsPerWeek": 2,
  "forbidNightToMorning": true,
  "forbidMorningToNightSameDay": false,
  "guaranteeFullCoverage": true,
  "allowEmergencyOverrides": true,
  "allowSecondShiftSameDayInEmergency": true,
  "ignoreAvailabilityInEmergency": false,
  "allowNightCapOverrideInEmergency": true,
  "allowRestRuleOverrideInEmergency": true,
  "goalMinimizeStaffCost": true,
  "goalMaximizePreferenceSatisfaction": true,
  "goalBalanceWorkload": false,
  "goalBalanceNightWorkload": false,
  "goalReduceUndesirableShifts": true,
  "penaltyWeightJson": null,
  "fairnessWeightJson": null,
  "goalPriorityJson": null,
  "numSearchWorkers": 8,
  "timeLimitSec": 20,
  "attributes": {},
  "isActive": true,
  "createdAt": "2026-03-01T00:00:00.000Z"
}
```

All create/update request fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes (create) | Profile name |
| `description` | string | no | Free-text description |
| `assignedTo` | string | no | Department label (display only) |
| `color` | `"primary"` \| `"warning"` \| `"success"` | no | UI accent color, default `"primary"` |
| `maxConsecutiveWorkDays` | int \| null | no | |
| `maxConsecutiveNightShifts` | int \| null | no | |
| `minRestHoursBetweenShifts` | int \| null | no | |
| `maxShiftsPerDay` | int | no | Default: 1 |
| `minDaysOffPerWeek` | int | no | Default: 2 |
| `maxNightsPerWeek` | int | no | Default: 2 |
| `forbidNightToMorning` | boolean | no | Default: true |
| `forbidMorningToNightSameDay` | boolean | no | Default: false |
| `guaranteeFullCoverage` | boolean | no | Default: true |
| `allowEmergencyOverrides` | boolean | no | Default: true |
| `allowSecondShiftSameDayInEmergency` | boolean | no | Default: true |
| `ignoreAvailabilityInEmergency` | boolean | no | Default: false |
| `allowNightCapOverrideInEmergency` | boolean | no | Default: true |
| `allowRestRuleOverrideInEmergency` | boolean | no | Default: true |
| `goalMinimizeStaffCost` | boolean | no | Default: true |
| `goalMaximizePreferenceSatisfaction` | boolean | no | Default: true |
| `goalBalanceWorkload` | boolean | no | Default: false |
| `goalBalanceNightWorkload` | boolean | no | Default: false |
| `goalReduceUndesirableShifts` | boolean | no | Default: true |
| `penaltyWeightJson` | object \| null | no | Solver penalty weights |
| `fairnessWeightJson` | object \| null | no | Solver fairness weights |
| `goalPriorityJson` | object \| null | no | Solver goal priority ordering |
| `numSearchWorkers` | int | no | Default: 8 |
| `timeLimitSec` | number | no | Default: 20 |
| `isActive` | boolean | no | Default: true |

---

### `GET /organizations/:orgId/constraint-profiles`

Returns all constraint profiles for the org — both org-scoped profiles and unit-scoped profiles belonging to units within the org.

Auth: JWT required

**Response — 200 OK**
```json
{ "profiles": [ { ...profile shape... } ] }
```

**Errors**
- `401` — missing or invalid JWT
- `404` — organization not found

---

### `POST /organizations/:orgId/constraint-profiles`

Creates a new org-scoped constraint profile.

Auth: JWT required

**Request** — any fields from the table above. `name` is required.

**Response — 201 Created**
```json
{ "profile": { ...profile shape... } }
```

**Errors**
- `400` — missing required fields
- `401` — missing or invalid JWT

---

### `PUT /organizations/:orgId/constraint-profiles/:id`

Updates an org-scoped constraint profile. All fields optional.

Auth: JWT required

**Request** — any fields from the table above.

**Response — 200 OK**
```json
{ "profile": { ...profile shape... } }
```

**Errors**
- `401` — missing or invalid JWT
- `404` — profile not found

---

### `DELETE /organizations/:orgId/constraint-profiles/:id`

Permanently deletes an org-scoped constraint profile.

Auth: JWT required

**Response — 200 OK**
```json
{ "ok": true }
```

**Errors**
- `401` — missing or invalid JWT
- `404` — profile not found

---

### `POST /units/:unitId/constraint-profiles`

Creates a unit-scoped constraint profile.

Auth: JWT required

**Request** — any fields from the table above. `name` is required.

**Response — 201 Created**
```json
{ "profile": { ...profile shape... } }
```

---

### `PATCH /units/:unitId/constraint-profiles/:id`

Updates a unit-scoped constraint profile. All fields optional.

Auth: JWT required

**Response — 200 OK**
```json
{ "profile": { ...profile shape... } }
```

---

### `POST /units/:unitId/constraint-profiles/:id/activate`

Marks a profile as active. By default deactivates all other profiles for that unit.

Auth: JWT required

**Query params**
- `deactivateOthers` — `"false"` to skip deactivating others (default: `true`)

**Response — 200 OK**
```json
{ "profile": { ...profile shape... } }
```

---

## Staff

All staff endpoints hit the Lambda. The actor (actorId, actorName) is derived from the JWT — no need to send it in the request body.

### `GET /staff`
Returns all staff records for the caller's organization.
```json
{ "ok": true, "staff": [{ "id": "19", "name": "สมชาย ใจดี", "employeeId": "EMP001", "lineId": "somchai_line", "position": "nurse", "email": "nurse@example.com", "status": "active" }] }
```

### `GET /staff/:id`
Returns a single staff record.
```json
{ "ok": true, "staff": { "id": "19", "name": "สมชาย ใจดี", "employeeId": "EMP001", "lineId": "somchai_line", "position": "nurse", "email": "nurse@example.com", "status": "active" } }
```

**Errors**
- `404` — staff not found or belongs to a different org.

### `POST /staff`
Creates a new staff member. Automatically appends a `CREATE_STAFF` audit log entry to S3.

**Request**
```json
{ "name": "ชื่อ นามสกุล", "employeeId": "EMP009", "lineId": "line_id_here", "position": "nurse", "email": "staff@example.com", "status": "active" }
```

**Response**
```json
{ "ok": true, "staff": { "id": "60", "name": "ชื่อ นามสกุล", "employeeId": "EMP009", ... } }
```

**Errors**
- `400` — missing required fields or `employeeId` already exists.

### `PATCH /staff/:id`
Updates any subset of fields. Automatically appends an `UPDATE_STAFF` audit log entry to S3.

**Request** (all fields optional)
```json
{ "name": "ชื่อใหม่", "employeeId": "EMP009", "lineId": "new_line_id", "position": "scheduler", "email": "new@example.com", "status": "inactive" }
```

**Response**
```json
{ "ok": true, "staff": { "id": "60", ... } }
```

### `DELETE /staff/:id`
Hard-deletes the worker row. Automatically appends a `DELETE_STAFF` audit log entry to S3.

**Response**
```json
{ "ok": true }
```

**Position codes**

| Code | Thai label | Permissions |
|---|---|---|
| `nurse` | พยาบาล | View own schedule only |
| `scheduler` | หัวหน้าพยาบาล | View/edit schedules, approve requests, manage staff, audit logs |
| `admin` | ผู้ดูแลระบบ | All permissions + system settings |

---

## Audit Logs

Audit log entries are stored in **S3** (`s3://maywin-artifacts-556088722017-ap-southeast-1/logs/audit-logs.csv`). The Lambda reads/writes the CSV directly — there is no local file. Rows are append-only and are never deleted.

Staff CRUD operations (create / patch / delete) write audit entries automatically server-side. The BFF does **not** need to POST to `/audit-logs` after those operations.

### `GET /audit-logs`
Returns all log entries, newest-first.

```json
{
  "ok": true,
  "logs": [
    {
      "timestamp": "2026-03-19T08:49:04.000Z",
      "actorId": "4",
      "actorName": "Admin",
      "action": "DELETE_STAFF",
      "targetType": "staff",
      "targetId": "EMP042",
      "detail": "Deleted staff สมชาย ใจดี (EMP042)"
    }
  ]
}
```

**Action values written automatically by the backend**

| Action | Trigger |
|---|---|
| `CREATE_STAFF` | `POST /staff` |
| `UPDATE_STAFF` | `PATCH /staff/:id` |
| `DELETE_STAFF` | `DELETE /staff/:id` |

### `GET /audit-logs?export=csv`
Streams the raw CSV from S3 as a file download.

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="audit-logs-<timestamp>.csv"
```

---

## Sites

Sites are physical locations belonging to an organization (e.g. a hospital campus or clinic branch). All endpoints are scoped to the caller's organization via JWT.

### `GET /sites`

List sites in the caller's organization.

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `search` | string | — | Filter by name or code (case-insensitive) |
| `active` | `"true"` \| `"false"` | — | Filter by active status |
| `limit` | number | 100 | Max results (1–300) |
| `offset` | number | 0 | Pagination offset |
| `sort` | `"ASC"` \| `"DESC"` | `"DESC"` | Sort by `created_at` |

**Response — 200 OK**
```json
{
  "items": [
    {
      "id": "1",
      "organizationId": "1",
      "name": "Main Hospital",
      "code": "MH01",
      "address": "123 Health St, Bangkok",
      "timezone": "Asia/Bangkok",
      "attributes": {},
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "limit": 100, "offset": 0 }
}
```

---

### `POST /sites`

Create a new site. Requires `ORG_ADMIN` or `UNIT_MANAGER` role.

**Request**
```json
{
  "organizationId": "1",
  "name": "Main Hospital",
  "code": "MH01",
  "address": "123 Health St, Bangkok",
  "timezone": "Asia/Bangkok",
  "attributes": {},
  "isActive": true
}
```

**Response — 201 Created**
```json
{
  "site": {
    "id": "1",
    "organizationId": "1",
    "name": "Main Hospital",
    "code": "MH01",
    "address": "123 Health St, Bangkok",
    "timezone": "Asia/Bangkok",
    "attributes": {},
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Notes:**
- `organizationId` must match the caller's JWT organization
- `code` must be unique within the organization

**Errors**
- `400` — Validation error or duplicate `code` within org
- `403` — Insufficient role or organization mismatch

---

### `POST /sites/:siteId/deactivate`

Deactivate a site (soft delete). Requires `ORG_ADMIN` or `UNIT_MANAGER` role.

**Response — 200 OK**
```json
{ "ok": true, "siteId": "1" }
```

**Errors**
- `403` — Insufficient role
- `404` — Site not found or belongs to a different org

---

### `POST /audit-logs`
Manually append a custom log entry. The actor is taken from the JWT — do not send actorId/actorName in the body.

**Request**
```json
{ "action": "APPROVE_REQUEST", "targetType": "request", "targetId": "REQ001", "detail": "Approved shift swap" }
```

**Response**
```json
{ "ok": true, "log": { "timestamp": "2026-03-19T09:00:00.000Z", "actorId": "4", "actorName": "Admin", "action": "APPROVE_REQUEST", "targetType": "request", "targetId": "REQ001", "detail": "Approved shift swap" } }
```


