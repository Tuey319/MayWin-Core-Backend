# MayWin Core Backend — API Reference

**Base URL (all routes):**
```
/api/v1/core
```
All endpoints require `Authorization: Bearer <accessToken>` unless marked **Public**.

---

## Table of Contents

1. [Auth](#auth)
2. [Health](#health)
3. [Organizations](#organizations)
4. [Sites](#sites)
5. [Units](#units)
6. [Roles](#roles)
7. [Unit Configuration](#unit-configuration)
   - [Shift Templates](#shift-templates)
   - [Constraint Profiles](#constraint-profiles)
   - [Coverage Rules](#coverage-rules)
8. [Staff](#staff)
9. [Workers](#workers)
10. [Worker Availability](#worker-availability)
11. [Worker Preferences](#worker-preferences)
12. [Schedules](#schedules)
13. [Schedule Assignments](#schedule-assignments)
14. [Jobs (Solver)](#jobs-solver)
15. [Worker Messages](#worker-messages)
16. [Orchestrator](#orchestrator)
17. [Webhook (LINE)](#webhook-line)
18. [Audit Logs](#audit-logs)

---

## Auth

### `POST /auth/login`

**Public.** Step 1 of 2FA login. Validates credentials and sends a 6-digit OTP to the user's email.

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
  "otpToken": "eyJ..."
}
```

- `otpToken` is short-lived (10 min). Pass it with the OTP code to `/auth/verify-otp`.
- In development (no SMTP), the OTP is printed to console.

**Errors:** `401` invalid credentials

---

### `POST /auth/verify-otp`

**Public.** Step 2 of 2FA. Validates the OTP code + pending token. Returns the real JWT access token.

**Request**
```json
{
  "otpToken": "eyJ...",
  "otp": "123456"
}
```

**Response — 200 OK**
```json
{
  "accessToken": "eyJ...",
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

**Errors:** `401` invalid/expired otpToken, incorrect OTP

---

### `POST /auth/signup`

**Public.** Register a new user account.

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
| `organizationId` | numeric string | yes | |
| `unitId` | numeric string | no | Assigns to unit immediately |
| `email` | string | yes | |
| `password` | string | yes | Min 6 chars |
| `fullName` | string | yes | |
| `roleCode` | string | no | Default: `"NURSE"` |
| `attributes` | object | no | |

**Response — 200 OK** — same shape as verify-otp

**Errors:** `400` email exists or validation error

---

### `POST /auth/logout`

Logout the current user.

**Request**
```json
{ "deviceId": "device123" }
```

**Response — 200 OK**
```json
{ "ok": true }
```

---

### `GET /auth/me`

Returns the current user's JWT payload.

**Response — 200 OK**
```json
{
  "user": {
    "sub": 42,
    "email": "user@example.com",
    "fullName": "John Doe",
    "organizationId": 1,
    "roles": ["NURSE", "UNIT_MANAGER"],
    "unitIds": [2, 3],
    "iat": 1743505320,
    "exp": 1743533920
  }
}
```

**Errors:** `401`

---

### `PATCH /auth/me/username`

**Protected.** Updates the current user's full name.

**Request Body**
```json
{ "fullName": "Jane Doe" }
```

**Response — 200 OK**
```json
{
  "user": {
    "id": "42",
    "email": "user@example.com",
    "fullName": "Jane Doe"
  }
}
```

**Errors:** `400`, `401`

---

## Health

### `GET /health`

**Public.** Returns service health status.

**Response — 200 OK**
```json
{ "status": "ok" }
```

---

## Organizations

### `GET /organizations`

List organizations the authenticated user belongs to. `ADMIN` role receives all orgs; others receive only their own.

**Response — 200 OK**
```json
{
  "organizations": [
    {
      "id": "1",
      "name": "Bangkok Hospital",
      "code": "BKK",
      "timezone": "Asia/Bangkok",
      "attributes": {}
    }
  ]
}
```

---

### `GET /organizations/me`

Returns the organization of the currently authenticated user.

**Response — 200 OK** — same shape as single organization object.

---

### `GET /organizations/:orgId`

Returns a single organization by ID. Non-admin users restricted to own org.

**Errors:** `401`, `403` (org mismatch), `404`

---

### `POST /organizations`

**Public (bootstrap/admin only).** Creates a new organization.

**Request**
```json
{
  "name": "Bangkok Hospital",
  "code": "BKK",
  "timezone": "Asia/Bangkok",
  "attributes": {}
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `code` | string | yes | Short unique code |
| `timezone` | string | no | Default: `"Asia/Bangkok"` |
| `attributes` | object | no | |

**Response — 201 Created**
```json
{
  "organization": {
    "id": "1",
    "name": "Bangkok Hospital",
    "code": "BKK",
    "timezone": "Asia/Bangkok",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### `PUT /organizations`

Full org-tree upsert for the authenticated user's organization.

**Request** — the full organizations array (same shape as `GET /organizations`)

**Response — 200 OK**
```json
{ "ok": true }
```

---

### `PATCH /organizations/:orgId`

Partially updates an organization. All fields optional.

**Request**
```json
{
  "name": "Updated Name",
  "code": "NEW",
  "timezone": "Asia/Bangkok",
  "attributes": {}
}
```

**Response — 200 OK** — updated organization object.

**Errors:** `401`, `403`, `404`

---

### `DELETE /organizations/:orgId`

Permanently deletes an organization.

**Response — 200 OK**
```json
{ "ok": true, "organizationId": "1" }
```

**Errors:** `401`, `403`, `404`

---

### `GET /organizations/:orgId/schedule-containers`

Lists all schedule containers for an organization.

**Response — 200 OK**
```json
{
  "containers": [
    {
      "id": "c-1",
      "name": "May 2026",
      "site": "Main Campus",
      "dept": "ICU",
      "start": "2026-05-01",
      "end": "2026-05-31",
      "status": "active",
      "notes": "",
      "profileId": "p-1"
    }
  ]
}
```

**Errors:** `401`, `404`

---

### `POST /organizations/:orgId/schedule-containers`

Creates a new schedule container.

**Request**
```json
{
  "name": "May 2026",
  "site": "Main Campus",
  "dept": "ICU",
  "start": "2026-05-01",
  "end": "2026-05-31",
  "status": "draft",
  "notes": "",
  "profileId": "p-1"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `site` | string | no | Display only |
| `dept` | string | no | Display only |
| `start` | YYYY-MM-DD | yes | |
| `end` | YYYY-MM-DD | yes | |
| `status` | `"draft"` \| `"active"` \| `"archived"` | no | Default `"draft"` |
| `notes` | string | no | |
| `profileId` | string | no | Linked constraint profile ID |

**Response — 201 Created** — `{ "container": { "id": "...", ... } }`

---

### `PUT /organizations/:orgId/schedule-containers/:id`

Updates an existing schedule container. All fields optional.

**Response — 200 OK** — `{ "container": { ... } }`

**Errors:** `401`, `404`

---

### `DELETE /organizations/:orgId/schedule-containers/:id`

Permanently deletes a schedule container.

**Response — 200 OK** — `{ "ok": true }`

**Errors:** `401`, `404`

---

### `GET /organizations/:orgId/constraint-profiles`

Lists constraint profiles scoped to the organization.

**Response — 200 OK**
```json
{
  "profiles": [ { "id": "1", "name": "ICU Standard", ... } ]
}
```

---

### `POST /organizations/:orgId/constraint-profiles`

Creates an org-level constraint profile. See [Constraint Profiles](#constraint-profiles) for the full field set.

**Response — 201 Created** — `{ "profile": { ... } }`

---

### `PUT /organizations/:orgId/constraint-profiles/:id`

Updates an org-level constraint profile.

**Response — 200 OK** — `{ "profile": { ... } }`

---

### `DELETE /organizations/:orgId/constraint-profiles/:id`

Deletes an org-level constraint profile.

**Response — 200 OK** — `{ "ok": true }`

---

## Sites

### `GET /sites`

Lists sites for the authenticated user's organization.

**Query params (all optional)**

| Param | Type | Notes |
|---|---|---|
| `search` | string | Filter by name/code |
| `active` | `"true"` \| `"false"` | |
| `limit` | number | |
| `offset` | number | |

**Response — 200 OK**
```json
{
  "sites": [
    { "id": "1", "name": "Main Campus", "code": "MAIN", "organizationId": "1", "isActive": true }
  ]
}
```

---

### `POST /sites`

Creates a new site.

**Request**
```json
{
  "organizationId": "1",
  "name": "Main Campus",
  "code": "MAIN",
  "description": "",
  "attributes": {}
}
```

**Response — 201 Created** — `{ "site": { ... } }`

---

### `PATCH /sites/:siteId`

Partially updates a site.

**Response — 200 OK** — `{ "site": { ... } }`

---

### `POST /sites/:siteId/activate`

Reactivates a soft-deactivated site.

**Response — 200 OK** — `{ "ok": true }`

---

### `POST /sites/:siteId/deactivate`

Soft-deactivates a site (`isActive = false`).

**Response — 200 OK** — `{ "ok": true }`

---

### `DELETE /sites/:siteId`

Permanently deletes a site.

**Response — 200 OK** — `{ "ok": true }`

---

## Units

### `GET /units`

Lists units for the authenticated user's organization/site.

**Query params (all optional)**

| Param | Type | Notes |
|---|---|---|
| `search` | string | Filter by name/code |
| `siteId` | numeric string | Filter by site |
| `active` | `"true"` \| `"false"` | |
| `limit` | number | |
| `offset` | number | |
| `sort` | `"ASC"` \| `"DESC"` | |

**Response — 200 OK**
```json
{
  "units": [
    { "id": "2", "name": "ICU", "code": "ICU", "organizationId": "1", "siteId": null, "isActive": true, "attributes": {} }
  ]
}
```

---

### `GET /units/:unitId`

Returns a single unit by ID.

**Response — 200 OK** — `{ "unit": { ... } }`

**Errors:** `401`, `404`

---

### `POST /units`

Creates a new unit.

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

**Response — 201 Created** — `{ "unit": { ... } }`

---

### `PATCH /units/:unitId`

Partially updates a unit. All fields optional.

**Response — 200 OK** — `{ "unit": { ... } }`

---

### `POST /units/:unitId/deactivate`

Soft-deactivates a unit.

**Response — 200 OK** — `{ "ok": true }`

---

### `DELETE /units/:unitId`

Permanently deletes a unit.

**Response — 200 OK** — `{ "ok": true, "unitId": "2" }`

---

### `GET /units/:unitId/members`

Lists all members of a unit from both `unit_memberships` (user accounts) and `worker_unit_memberships` (worker profiles).

**Access control:** user must be ADMIN, have `unitId` in their JWT `unitIds`, or share the same `organizationId`.

**Response — 200 OK**
```json
{
  "members": [
    {
      "id": "1",
      "type": "user",
      "userId": "42",
      "workerId": null,
      "unitId": "2",
      "roleCode": "NURSE",
      "name": null,
      "workerCode": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "69",
      "type": "worker",
      "userId": "42",
      "workerId": "69",
      "unitId": "2",
      "roleCode": "NURSE",
      "name": "สมชาย ใจดี",
      "workerCode": "EMP069",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

| Field | Notes |
|---|---|
| `type` | `"user"` = unit_memberships row; `"worker"` = worker profile row |
| `userId` | `null` for workers with no web account |
| `workerId` | `null` for pure user-account members |

---

### `POST /units/:unitId/members`

Adds a user to a unit.

**Request**
```json
{ "userId": "42", "roleCode": "NURSE" }
```

**Response — 201 Created** — `{ "member": { ... } }`

**Errors:** `401`, `404`, `409` already a member

---

### `DELETE /units/:unitId/members/:userId`

Removes a user from a unit.

**Response — 200 OK** — `{ "ok": true }`

---

## Roles

### `GET /roles`

Lists all system roles.

**Response — 200 OK**
```json
{
  "roles": [
    { "id": "1", "code": "ADMIN", "name": "Administrator" },
    { "id": "2", "code": "ORG_ADMIN", "name": "Organization Admin" },
    { "id": "3", "code": "UNIT_MANAGER", "name": "Unit Manager" },
    { "id": "4", "code": "NURSE", "name": "Nurse" }
  ]
}
```

---

## Unit Configuration

### `GET /units/:unitId/config`

One-shot configuration payload for the scheduling UI: shift templates, active constraint profile, and coverage rules.

**Response — 200 OK**
```json
{
  "shiftTemplates": [ { "id": "1", "code": "M", "name": "Morning", ... } ],
  "constraintProfile": { "id": "2", "name": "ICU Standard", ... },
  "coverageRules": [ { "id": "1", "shiftCode": "M", "minWorkers": 3, ... } ]
}
```

---

### Shift Templates

#### `GET /units/:unitId/shift-templates`

Lists all active shift templates for a unit.

**Response — 200 OK**
```json
{
  "shiftTemplates": [
    {
      "id": "1",
      "unitId": "2",
      "code": "M",
      "name": "Morning",
      "startTime": "07:00",
      "endTime": "15:00",
      "color": "#4CAF50",
      "isActive": true
    }
  ]
}
```

#### `POST /units/:unitId/shift-templates`

Creates a shift template.

**Request**
```json
{
  "code": "M",
  "name": "Morning",
  "startTime": "07:00",
  "endTime": "15:00",
  "color": "#4CAF50"
}
```

**Response — 201 Created** — `{ "shiftTemplate": { ... } }`

#### `PATCH /units/:unitId/shift-templates/:id`

Partially updates a shift template.

**Response — 200 OK** — `{ "shiftTemplate": { ... } }`

#### `DELETE /units/:unitId/shift-templates/:id`

Soft-deletes a shift template (`isActive = false`).

**Response — 200 OK** — `{ "ok": true }`

---

### Constraint Profiles

Constraint profiles control solver behavior. Each field maps directly to a solver constraint. Profiles are scoped to a unit (`unitId` set) or an organization (`orgId` set). Only one profile can be active per unit at a time.

**Profile object shape**
```json
{
  "id": "1",
  "unitId": "2",
  "orgId": null,
  "name": "ICU Standard",
  "description": "Standard ICU shift rules",
  "assignedTo": "ICU",
  "color": "primary",
  "isActive": true,
  "maxConsecutiveWorkDays": 5,
  "maxConsecutiveNightShifts": 2,
  "minRestHoursBetweenShifts": 11,
  "maxShiftsPerDay": 1,
  "minDaysOffPerWeek": 2,
  "maxNightsPerWeek": 2,
  "forbidNightToMorning": true,
  "forbidEveningToNight": false,
  "forbidMorningToNightSameDay": false,
  "guaranteeFullCoverage": true,
  "allowEmergencyOverrides": true,
  "allowSecondShiftSameDayInEmergency": true,
  "ignoreAvailabilityInEmergency": false,
  "allowNightCapOverrideInEmergency": true,
  "allowRestRuleOverrideInEmergency": true,
  "goalMinimizeStaffCost": true
}
```

#### `GET /constraint-profiles`

Lists **all** constraint profiles across every unit and organisation.

**Response — 200 OK** — `{ "profiles": [ { ... } ] }`

#### `GET /units/:unitId/constraint-profiles`

Lists all constraint profiles for a unit. Also available as `GET /units/:unitId/profiles`.

**Response — 200 OK** — `{ "profiles": [ { ... } ] }`

#### `POST /units/:unitId/constraint-profiles`

Creates a unit-level constraint profile.

**Response — 201 Created** — `{ "profile": { ... } }`

#### `PATCH /units/:unitId/constraint-profiles/:id`

Partially updates a constraint profile. All fields optional.

**Response — 200 OK** — `{ "profile": { ... } }`

#### `POST /units/:unitId/constraint-profiles/:id/activate`

Activates a constraint profile. Optionally deactivates all others.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `deactivateOthers` | `"true"` \| `"false"` | Default `false` |

**Response — 200 OK** — `{ "profile": { ..., "isActive": true } }`

---

### Coverage Rules

Coverage rules define required staffing levels per shift and date type.

#### `GET /units/:unitId/coverage-rules`

Lists all coverage rules for a unit (also via `GET /units/:unitId/config`).

**Response — 200 OK**
```json
{
  "coverageRules": [
    {
      "id": "1",
      "unitId": "2",
      "shiftCode": "M",
      "dateType": "WEEKDAY",
      "minWorkers": 3,
      "maxWorkers": 5
    }
  ]
}
```

#### `POST /units/:unitId/coverage-rules`

Creates a coverage rule.

**Request**
```json
{
  "shiftCode": "M",
  "dateType": "WEEKDAY",
  "minWorkers": 3,
  "maxWorkers": 5
}
```

**Response — 201 Created** — `{ "coverageRule": { ... } }`

#### `PATCH /units/:unitId/coverage-rules/:id`

Partially updates a coverage rule.

**Response — 200 OK** — `{ "coverageRule": { ... } }`

#### `DELETE /units/:unitId/coverage-rules/:id`

Deletes a coverage rule.

**Response — 200 OK** — `{ "ok": true }`

#### `PUT /units/:unitId/coverage-rules`

Bulk replaces all coverage rules for a unit (replaces the entire set atomically).

**Request**
```json
{
  "rules": [
    { "shiftCode": "M", "dateType": "WEEKDAY", "minWorkers": 3, "maxWorkers": 5 },
    { "shiftCode": "N", "dateType": "WEEKEND", "minWorkers": 2, "maxWorkers": 3 }
  ]
}
```

**Response — 200 OK** — `{ "coverageRules": [ { ... } ] }`

---

## Staff

### `GET /staff`

Lists all staff in the authenticated user's organization.

**Response — 200 OK**
```json
{
  "staff": [
    {
      "id": "69",
      "fullName": "สมชาย ใจดี",
      "workerCode": "EMP069",
      "employmentType": "FULL_TIME",
      "unitId": "2",
      "isActive": true,
      "attributes": {}
    }
  ]
}
```

---

### `GET /staff/:id`

Returns a single staff member.

**Response — 200 OK** — `{ "staff": { ... } }`

**Errors:** `401`, `404`

---

### `POST /staff`

Creates a staff member (also creates a linked `Worker` record).

**Request**
```json
{
  "fullName": "สมชาย ใจดี",
  "workerCode": "EMP069",
  "employmentType": "FULL_TIME",
  "unitId": "2",
  "attributes": {}
}
```

**Response — 201 Created** — `{ "staff": { ... } }`

---

### `PATCH /staff/:id`

Partially updates a staff member.

**Response — 200 OK** — `{ "staff": { ... } }`

---

### `DELETE /staff/:id`

Soft-deactivates a staff member (`isActive = false`). Appends an audit log entry.

**Response — 200 OK** — `{ "ok": true }`

---

### `POST /staff/:id/link-user`

Links an existing user account to this worker by setting `workers.linked_user_id`.

**Request**
```json
{ "userId": 5 }
```

**Response — 200 OK** — `{ "ok": true, "staff": { ... } }`

**Errors:** `400` (invalid id/userId), `404` (worker or user not found in organization)

---

### `POST /staff/:id/link-token`

Generates a one-time LINE invite token so the nurse can link their LINE account.

**Response — 200 OK**
```json
{
  "token": "abc123-one-time-token",
  "expiresAt": "2026-04-01T12:00:00.000Z"
}
```

---

## Workers

### `GET /workers/me/schedule`

**Protected.** Returns the authenticated nurse's shift assignments for a given month. The worker profile is resolved from the JWT (`sub` → `workers.linked_user_id`).

**Query params**

| Param | Type | Required | Notes |
|---|---|---|---|
| `month` | `string` | No | `YYYY-MM` format. Defaults to current month. |

**Response — 200 OK**
```json
{
  "worker": { "id": 3, "fullName": "Nurse Name", "workerCode": "N001" },
  "month": "2026-04",
  "schedule": { "id": 12, "name": "April 2026 Schedule", "status": "PUBLISHED" },
  "shiftTemplates": [
    { "code": "M", "name": "เช้า", "startTime": "07:00:00", "endTime": "15:00:00" },
    { "code": "A", "name": "บ่าย", "startTime": "15:00:00", "endTime": "23:00:00" },
    { "code": "N", "name": "ดึก", "startTime": "23:00:00", "endTime": "07:00:00" }
  ],
  "days": [
    {
      "date": "2026-04-01",
      "shifts": [
        { "shiftCode": "M", "shiftName": "เช้า", "startTime": "07:00:00", "endTime": "15:00:00", "isOvertime": false }
      ]
    },
    { "date": "2026-04-02", "shifts": [] }
  ]
}
```

If no published schedule exists for the month, `schedule` is `null` and `days` is `[]`.

**Errors:** `400` (invalid month format), `401`, `404` (no worker profile linked to account)

---

### `GET /units/:unitId/workers`

Lists workers assigned to a unit.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `search` | string | Filter by name or workerCode |

**Response — 200 OK**
```json
{
  "workers": [
    {
      "id": "69",
      "fullName": "สมชาย ใจดี",
      "workerCode": "EMP069",
      "employmentType": "FULL_TIME",
      "attributes": {}
    }
  ]
}
```

---

### `GET /units/:unitId/kpis/summary`

Returns dashboard KPI metrics (satisfaction, fairness) for the unit.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `startDate` | YYYY-MM-DD | Optional window start |
| `endDate` | YYYY-MM-DD | Optional window end |

**Response — 200 OK**
```json
{
  "schema": "DashboardKpi.v1",
  "unitId": "2",
  "source": "s3_kpi",
  "window": { "startDate": "2026-03-01", "endDate": "2026-03-31" },
  "metrics": {
    "satisfaction": { "average": 0.8231 },
    "fairness": {
      "workloadStdDev": 0.718795,
      "workloadMin": 23,
      "workloadMax": 26,
      "workerCount": 30
    }
  }
}
```

`source` values: `artifact_metadata`, `s3_kpi`, `solver_runs`, `latest_schedule_run`, `none`

---

### `GET /nurses/export`

Compatibility endpoint. Returns nurse list with overall satisfaction KPI.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `unitId` | numeric string | Required |

**Response — 200 OK**
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

---

## Worker Availability

### `GET /units/:unitId/availability`

Fetches availability entries for all workers in a unit over a date range.

**Query params**

| Param | Type | Required | Notes |
|---|---|---|---|
| `dateFrom` | YYYY-MM-DD | yes | |
| `dateTo` | YYYY-MM-DD | yes | |

**Response — 200 OK**
```json
{
  "availability": [
    {
      "id": "1",
      "workerId": "69",
      "date": "2026-03-01",
      "shiftCode": "M",
      "type": "AVAILABLE"
    }
  ]
}
```

`type` values: `AVAILABLE`, `UNAVAILABLE`, `DAY_OFF`, `BLOCKED`

---

### `PUT /units/:unitId/availability`

Bulk upserts availability entries.

**Request**
```json
{
  "availability": [
    { "workerId": "69", "date": "2026-03-01", "shiftCode": "M", "type": "AVAILABLE" }
  ]
}
```

**Response — 200 OK** — `{ "upserted": 1 }`

---

## Worker Preferences

### `GET /units/:unitId/workers/preferences`

Admin view — returns all workers in a unit with their current preference objects.

**Response — 200 OK**
```json
{
  "workerPreferences": {
    "items": [
      {
        "worker": {
          "id": 42,
          "fullName": "Nurse A",
          "workerCode": "N042",
          "attributes": {},
          "employmentType": "FULL_TIME"
        },
        "preferences": {
          "id": "pref-1",
          "preference_pattern_json": {
            "2026-03-01": { "morning": 9, "night": 3 },
            "2026-03-02": { "evening": 7 }
          }
        }
      }
    ]
  }
}
```

---

### `GET /workers/:workerId/preferences`

Returns stored preferences for a single worker.

**Response — 200 OK** — same shape as single `preferences` object above.

---

### `PUT /workers/:workerId/preferences`

Upserts preferences for a worker.

**Request**
```json
{
  "unitId": "2",
  "preference_pattern_json": {
    "2026-03-01": { "morning": 9 }
  },
  "days_off_pattern_json": {
    "2026-03-05": true
  }
}
```

**Response — 200 OK** — `{ "preferences": { ... } }`

---

### `PUT /workers/:workerId/request-schedule`

Nurse submits shift preferences and optionally triggers the scheduling engine.

**Request** — same shape as `PUT /workers/:workerId/preferences`

**Response — 200 OK** — `{ "preferences": { ... }, "jobId": "..." }`

---

### `DELETE /workers/:workerId/preferences`

Deletes all preferences for a worker.

**Response — 200 OK**
```json
{ "workerId": "42", "deleted": true }
```

**Errors:** `404` worker not found or no preferences row

---

### `DELETE /workers/:workerId/preferences/requests/:date`

Removes a single date entry from the worker's `preference_pattern_json` (reject one request).

**Example:** `DELETE /workers/42/preferences/requests/2026-03-01`

**Response — 200 OK**
```json
{ "workerId": "42", "deletedDate": "2026-03-01", "remaining": 2 }
```

**Errors:** `404` no preferences row or no entry for that date

---

### `DELETE /workers/:workerId/preferences/days-off/:date`

Rejects a day-off request for a specific date. Removes from both `days_off_pattern_json` and `worker_availability` rows with `type = DAY_OFF`.

**Example:** `DELETE /workers/42/preferences/days-off/2026-03-01`

**Response — 200 OK**
```json
{
  "workerId": "42",
  "deletedDate": "2026-03-01",
  "removedFromDaysOffPattern": true,
  "removedAvailabilityRows": 1,
  "remainingPatternDaysOffCount": 3
}
```

**Errors:** `404` no day-off entry found for that date

---

## Schedules

### `GET /schedules`

Lists **all** schedules across every unit and organisation, ordered by most recently created.

**Response — 200 OK**
```json
{
  "schedules": [
    {
      "id": "42",
      "organizationId": "1",
      "unitId": "5",
      "name": "March 2026",
      "startDate": "2026-03-01",
      "endDate": "2026-03-31",
      "status": "PUBLISHED",
      "jobId": null,
      "constraintProfileId": "cp-uuid",
      "createdAt": "2026-02-15T08:00:00.000Z",
      "publishedAt": "2026-02-20T12:00:00.000Z"
    }
  ]
}
```

---

### `POST /units/:unitId/schedules`

Creates a new schedule container. Does **not** run the solver — call `POST /schedules/:scheduleId/jobs` to generate assignments.

**Request**
```json
{
  "name": "March 2026",
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "constraintProfileId": "1"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `startDate` | YYYY-MM-DD | yes | |
| `endDate` | YYYY-MM-DD | yes | |
| `constraintProfileId` | numeric string | no | |

**Response — 201 Created**
```json
{
  "schedule": {
    "id": "42",
    "organizationId": "1",
    "unitId": "2",
    "name": "March 2026",
    "startDate": "2026-03-01",
    "endDate": "2026-03-31",
    "status": "DRAFT",
    "constraintProfileId": "1",
    "jobId": null,
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
}
```

**Errors:** `400`, `401`, `404` unit not found

---

### `GET /units/:unitId/schedules/current`

Fetches the current schedule + assignments for a unit.

**Query params (all optional)**

| Param | Type | Notes |
|---|---|---|
| `dateFrom` | YYYY-MM-DD | |
| `dateTo` | YYYY-MM-DD | |

**Response — 200 OK**
```json
{
  "schedule": { "id": "42", "name": "March 2026", "status": "PUBLISHED", ... },
  "assignments": [
    {
      "id": "a-1",
      "workerId": "69",
      "date": "2026-03-01",
      "shiftCode": "M",
      "shiftOrder": 1,
      "isOvertime": false
    }
  ]
}
```

Shift codes: `M` (Morning), `A` (Evening/Afternoon), `N` (Night), `off` (Day off)

---

### `GET /units/:unitId/schedules/history`

Lists past schedule runs for a unit.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `limit` | number | Default 10 |

**Response — 200 OK** — `{ "schedules": [ { ... } ] }`

---

### `GET /schedules/:scheduleId`

Returns a single schedule by ID.

**Response — 200 OK** — `{ "schedule": { ... } }`

---

### `GET /schedules/:scheduleId/export`

Exports a schedule.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `format` | `"pdf"` \| `"csv"` | Default `"csv"` |

**Response — 200 OK** — file stream or signed S3 URL.

---

### `GET /schedule` (BFF compat alias)

Compatibility alias. Returns the current schedule for a unit.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `unitId` | numeric string | Required |

---

## Schedule Assignments

### `PATCH /schedule-assignments/:assignmentId`

Manually overrides a single assignment.

**Request**
```json
{
  "shiftCode": "N",
  "isOvertime": false
}
```

**Response — 200 OK** — `{ "assignment": { ... } }`

---

## Jobs (Solver)

### `POST /schedules/:scheduleId/jobs`

Enqueues a solver job for a schedule. Supports idempotent submission.

**Headers**

| Header | Notes |
|---|---|
| `Idempotency-Key` | Optional; prevents duplicate jobs on retry |

**Request**
```json
{
  "startDate": "2026-03-01T00:00:00.000Z",
  "endDate": "2026-03-31T23:59:59.999Z",
  "strategy": { "plan": "A", "mode": "strict" },
  "solverConfig": { "timeLimitSeconds": 120 },
  "options": { "dryRun": false },
  "notes": "March schedule"
}
```

> `dto.length` (number of days) can be provided instead of `endDate`. The backend computes `endDate = startDate + (length - 1) days`.

**Response — `LOCAL_RUNNER` mode**
```json
{
  "ok": true,
  "mode": "LOCAL_RUNNER",
  "jobId": "job-uuid",
  "executionArn": null,
  "job": {
    "id": "job-uuid",
    "scheduleId": "42",
    "state": "REQUESTED",
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
}
```

**Response — `STEP_FUNCTIONS` mode**
```json
{
  "ok": true,
  "mode": "STEP_FUNCTIONS",
  "jobId": "job-uuid",
  "executionArn": "arn:aws:states:...",
  "job": { "id": "job-uuid", "scheduleId": "42", "state": "REQUESTED", ... },
  "execution": {
    "arn": "arn:aws:states:...",
    "startDate": "2026-03-01T00:00:00.000Z",
    "name": "job-<uuid>-<ts>",
    "stateMachineArn": "arn:aws:states:..."
  }
}
```

---

### `GET /jobs/:jobId`

Poll job status and phase. Also available as `GET /schedule-jobs/:jobId`.

**Response — 200 OK**
```json
{
  "job": {
    "id": "job-uuid",
    "scheduleId": "42",
    "state": "COMPLETED",
    "phase": "COMPLETED",
    "createdAt": "2026-03-01T00:00:00.000Z",
    "updatedAt": "2026-03-01T00:30:00.000Z",
    "errorCode": null,
    "errorMessage": null
  }
}
```

**Job states**

| `state` | `phase` | Meaning |
|---|---|---|
| `REQUESTED` | `REQUESTED` | Job created, queued |
| `VALIDATED` | `VALIDATING` | Input validation passed |
| `NORMALIZING` | `NORMALIZING` | Building normalized input |
| `SOLVING_A_STRICT` | `STRICT_PASS` | Running strict CP-SAT plan |
| `SOLVING_A_RELAXED` | `RELAXED_PASS` | Running relaxed CP-SAT plan |
| `SOLVING_B_MILP` | `MILP_FALLBACK` | Running MILP fallback |
| `EVALUATING` | `EVALUATING` | Evaluating results |
| `PERSISTING` | `PERSISTING` | Writing to database |
| `COMPLETED` | `COMPLETED` | Terminal — success |
| `FAILED` | `FAILED` | Terminal — see `errorCode` |

---

### `GET /jobs/:jobId/solver-payload`

Returns the normalized solver input payload for a given job. This is useful for debugging why certain shifts are not assigned, analyzing coverage gaps, and understanding the exact constraints sent to the solver.

**Response — 200 OK**
```json
{
  "jobId": "job-uuid",
  "scheduleId": "42",
  "artifact": {
    "id": "art-uuid",
    "type": "NORMALIZED_INPUT",
    "storage": {
      "bucket": "maywin-artifacts-...",
      "key": "core/job-uuid/normalized-input.json",
      "provider": "s3"
    },
    "hash": "sha256:...",
    "sizeBytes": 123456,
    "createdAt": "2026-03-01T00:00:00.000Z"
  },
  "payload": {
    "meta": { "scheduleId": "42", "unitId": 5, "... ": "..." },
    "nurses": [
      {
        "workerCode": "001",
        "regularShiftsPerPeriod": 18,
        "maxOvertimeShifts": 5,
        "nightsPerWeek": 2,
        "daysOffPerWeek": 2
      }
    ],
    "availabilityRestrictions": [
      {
        "workerCode": "001",
        "date": "2026-03-01",
        "shiftCode": "NIGHT",
        "type": "UNAVAILABLE"
      }
    ],
    "preferenceWeights": [ { "workerCode": "...", "shifts": [...], "... ": "..." } ],
    "coverageRules": [ { "dayType": "WEEKDAY", "shifts": [...], "... ": "..." } ],
    "constraints": {
      "forbidNightToMorning": true,
      "forbidEveningToNight": true,
      "maxShiftsPerDay": 2,
      "allowSecondShiftSameDayInEmergency": true
    }
  }
}
```

**When to use:**
- Diagnose why a shift is not filled (check availabilityRestrictions for that worker/date/shift)
- Verify constraint settings are correct for the unit's solving strategy
- Inspect nurse workload distribution (regularShiftsPerPeriod, maxOvertimeShifts) before rerunning a job
- Debug sequence constraint violations (forbidNightToMorning, forbidEveningToNight)
- Analyze preference penalties applied to each worker

**Errors:** `404` if job or normalized artifact not found. `500` if S3 read fails.

---

### `GET /jobs/:jobId/artifacts`

Lists artifacts stored for a job.

**Response — 200 OK**
```json
{
  "artifacts": [
    {
      "id": "art-1",
      "jobId": "job-uuid",
      "type": "NORMALIZED_INPUT",
      "bucket": "maywin-artifacts",
      "key": "maywin-artifacts/core/job-uuid/normalized-input.json",
      "sha256": "abc123",
      "bytes": 12345,
      "createdAt": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

Artifact `type` values: `NORMALIZED_INPUT`, `SOLVER_OUTPUT`, `SOLVER_KPI`, `SCHEDULE_EXPORT`

---

### `GET /jobs/:jobId/preview`

Returns the solver output read-only (before applying).

**Response — 200 OK**
```json
{
  "assignments": [
    { "workerId": "69", "date": "2026-03-01", "shiftCode": "M", "shiftOrder": 1, "isOvertime": false }
  ],
  "kpis": {
    "satisfaction": { "average": 0.81 },
    "understaffedShifts": 2
  }
}
```

---

### `POST /jobs/:jobId/apply`

Persists solver output into the schedule.

**Request**
```json
{ "overwriteManualChanges": false }
```

**Response — 200 OK** — `{ "ok": true, "assignmentsWritten": 150 }`

---

### `POST /jobs/:jobId/cancel`

Cancels an in-progress job.

**Response — 200 OK** — `{ "ok": true }`

---

## Worker Messages

### `POST /workers/:workerId/messages`

Creates a message for a worker (manager → worker direction).

**Request**
```json
{
  "subject": "Schedule Update",
  "body": "Your March schedule is ready.",
  "direction": "OUTBOUND",
  "jobId": null
}
```

**Response — 201 Created** — `{ "message": { ... } }`

---

### `GET /workers/:workerId/messages`

Lists messages for a worker.

**Query params (all optional)**

| Param | Type | Notes |
|---|---|---|
| `direction` | `"INBOUND"` \| `"OUTBOUND"` | |
| `status` | `"SENT"` \| `"DELIVERED"` \| `"READ"` \| `"ARCHIVED"` | |
| `limit` | number | |
| `offset` | number | |

**Response — 200 OK** — `{ "messages": [ { ... } ] }`

---

### `POST /workers/:workerId/messages/chat`

Creates a chat-style message for a worker (used by the chatbot integration).

**Request**
```json
{ "body": "Hello, your schedule is ready!", "attributes": {} }
```

**Response — 201 Created** — `{ "message": { ... } }`

---

### `GET /units/:unitId/messages`

Manager inbox — lists all messages for workers in a unit.

**Query params (all optional):** same as worker messages query params.

**Response — 200 OK** — `{ "messages": [ { ... } ] }`

---

### `GET /jobs/:jobId/messages`

Lists messages associated with a specific solver job.

**Response — 200 OK** — `{ "messages": [ { ... } ] }`

---

### `POST /chat`

Creates an anonymous/auto-generated worker chat message (used internally by the LINE webhook flow).

**Request**
```json
{ "workerId": "69", "body": "I want morning shift on March 1st", "attributes": {} }
```

**Response — 201 Created** — `{ "message": { ... } }`

---

## Orchestrator

### `POST /orchestrator/run`

Entry point for running a full schedule workflow. Behavior depends on `ORCHESTRATION_MODE` env var.

**Request**
```json
{
  "scheduleId": "42",
  "idempotencyKey": "schedule-42-abc123",
  "dto": {
    "startDate": "2026-03-01T00:00:00.000Z",
    "endDate": "2026-03-31T23:59:59.999Z",
    "strategy": { "plan": "A", "mode": "strict" },
    "solverConfig": { "timeLimitSeconds": 120 },
    "options": { "dryRun": false }
  }
}
```

**Response** — same shape as `POST /schedules/:scheduleId/jobs`.

---

## Webhook (LINE)

### `POST /webhook`

**Public (LINE-signature-verified).** Handles inbound LINE Messaging API webhook events from nurses.

- Verifies LINE signature via `X-Line-Signature` header.
- Processes text messages, parses shift preferences, and replies via the LINE Messaging API.
- Stores conversation state in `chatbot_conversations`.
- Does **not** require JWT authentication.

**Request** — LINE webhook event payload (JSON body signed by LINE).

**Response — 200 OK** — `{ "ok": true }`

---

## Audit Logs

### `GET /audit-logs`

Lists audit log entries (newest first).

**Query params**

| Param | Type | Notes |
|---|---|---|
| `export` | `"csv"` | Returns full log as CSV download |

**Response — 200 OK (JSON)**
```json
{
  "logs": [
    {
      "id": "log-1",
      "actor": "user@example.com",
      "action": "staff.deactivate",
      "target": "EMP069",
      "timestamp": "2026-03-01T10:00:00.000Z",
      "attributes": {}
    }
  ]
}
```

**Response — 200 OK (CSV)** — streamed CSV file download when `?export=csv`.

---

### `POST /audit-logs`

Appends a new audit log entry. Actor is derived from the JWT.

**Request**
```json
{
  "action": "staff.deactivate",
  "target": "EMP069",
  "attributes": {}
}
```

**Response — 201 Created** — `{ "log": { ... } }`

---

## BFF Route Mapping

The Next.js BFF proxies browser requests to this backend. Quick reference:

| Method | BFF route | Backend endpoint |
|---|---|---|
| `POST` | `/api/auth/login` | `POST /auth/login` |
| `POST` | `/api/auth/verify-otp` | `POST /auth/verify-otp` |
| `POST` | `/api/auth/logout` | `POST /auth/logout` |
| `GET` | `/api/auth/me` | `GET /auth/me` |
| `PATCH` | `/api/auth/me/username` | `PATCH /auth/me/username` |
| `GET` | `/api/workers/me/schedule?month=` | `GET /workers/me/schedule` |
| `GET` | `/api/schedule` | `GET /schedule?unitId=` |
| `GET` | `/api/export` | `GET /nurses/export` |
| `GET` | `/api/preferences` | `GET /units/:id/workers/preferences` |
| `POST` | `/api/solver` | `POST /orchestrator/run` |
| `GET` | `/api/solver?jobId=` | `GET /schedule-jobs/:id` |
| `GET` | `/api/staff` | `GET /staff` |
| `POST` | `/api/staff` | `POST /staff` |
| `GET` | `/api/staff/:id` | `GET /staff/:id` |
| `PATCH` | `/api/staff/:id` | `PATCH /staff/:id` |
| `DELETE` | `/api/staff/:id` | `DELETE /staff/:id` |
| `GET` | `/api/audit-logs` | `GET /audit-logs` |
| `GET` | `/api/audit-logs?export=csv` | `GET /audit-logs?export=csv` |
| `POST` | `/api/audit-logs` | `POST /audit-logs` |
| `GET` | `/api/hospital` | `GET /organizations` + `GET /units` |
| `PUT` | `/api/hospital` | `PUT /organizations` |
| `GET` | `/api/hospital/containers` | `GET /organizations/:orgId/schedule-containers` |
| `POST` | `/api/hospital/containers` | `POST /organizations/:orgId/schedule-containers` |
| `PUT` | `/api/hospital/containers/:id` | `PUT /organizations/:orgId/schedule-containers/:id` |
| `DELETE` | `/api/hospital/containers/:id` | `DELETE /organizations/:orgId/schedule-containers/:id` |
| `GET` | `/api/hospital/profiles` | `GET /organizations/:orgId/constraint-profiles` |
| `POST` | `/api/hospital/profiles` | `POST /organizations/:orgId/constraint-profiles` |
| `PUT` | `/api/hospital/profiles/:id` | `PUT /organizations/:orgId/constraint-profiles/:id` |
| `DELETE` | `/api/hospital/profiles/:id` | `DELETE /organizations/:orgId/constraint-profiles/:id` |
| `GET` | `/api/units/:unitId/members` | `GET /units/:unitId/members` |
| `GET` | `/api/units/:unitId/profiles` | `GET /units/:unitId/profiles` |
