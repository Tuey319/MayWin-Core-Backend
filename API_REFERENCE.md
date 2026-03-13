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

### `POST /auth/login`

Used by: `src/app/api/auth/login/route.js` (real mode)

**Request**
```json
{
  "email": "admin@maywin.local",
  "password": "maywin12345"
}
```

**Expected response**
```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "1",
    "name": "Admin",
    "role": "ผู้ดูแล"
  }
}
```

> If your backend returns a different shape, update the mapping in `src/app/api/auth/login/route.js` around line 65.

---

## Schedule

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
    "notes": "30 nurses - 30 day schedule with realistic constraints",
    "length": 31
  }
}
```

**Response**
```json
{
  "ok": true,
  "jobId": "job-uuid-here",
  "executionArn": "arn:aws:states:...",
  "mode": "async"
}
```

---

### `GET /schedule-jobs/:jobId`

Used by: `src/app/api/solver/route.js` (GET handler, polled every 4s)

**Response**
```json
{
  "job": {
    "id": "job-uuid-here",
    "state": "COMPLETED"
  }
}
```

**Job states** — the BFF treats these as done:
- `completed`, `success`, `done`, `succeeded`

And these as failed:
- `failed`, `error`, `faulted`

Any other state (e.g. `pending`, `running`) keeps polling until 3-minute timeout.

---

## BFF routes summary

These are the Next.js API routes in `src/app/api/` that the browser talks to. They proxy to the Lambda and handle auth tokens server-side.

| Method | BFF route | Proxies to |
|---|---|---|
| `POST` | `/api/auth/login` | `/auth/login` |
| `POST` | `/api/auth/logout` | (clears cookie, no backend call) |
| `GET` | `/api/auth/me` | (reads cookie, no backend call) |
| `GET` | `/api/schedule` | `/schedule?unitId=2` |
| `GET` | `/api/export` | `/nurses/export` |
| `GET` | `/api/preferences?unitId=` | `/units/:id/workers/preferences` |
| `POST` | `/api/solver` | `/orchestrator/run` |
| `GET` | `/api/solver?jobId=` | `/schedule-jobs/:id` |
| `GET` | `/api/staff` | `data/staff.csv` (mock) |
| `POST` | `/api/staff` | `data/staff.csv` (mock) |
| `GET` | `/api/staff/:id` | `data/staff.csv` (mock) |
| `PATCH` | `/api/staff/:id` | `data/staff.csv` (mock) |
| `DELETE` | `/api/staff/:id` | `data/staff.csv` (mock) |
| `GET` | `/api/audit-logs` | `data/audit-logs.csv` (mock) |
| `GET` | `/api/audit-logs?export=csv` | Streams CSV file download |
| `POST` | `/api/audit-logs` | Appends to `data/audit-logs.csv` |

---

## Staff (mock CSV)

Data lives in `data/staff.csv`. The BFF reads/writes it directly — no backend Lambda involved.

### `GET /api/staff`
Returns all staff records.
```json
{ "ok": true, "staff": [{ "id": "1", "name": "สมชาย ใจดี", "employeeId": "EMP001", "lineId": "somchai_line", "position": "nurse", "email": "...", "status": "active" }] }
```

### `POST /api/staff`
Creates a new staff member. Appends an audit log entry.
```json
// Request
{ "name": "ชื่อ นามสกุล", "employeeId": "EMP009", "lineId": "line_id", "position": "nurse", "email": "...", "status": "active" }
// Response 201
{ "ok": true, "staff": { "id": "9", ... } }
```

### `PATCH /api/staff/:id`
Updates any fields. Appends an audit log entry.

### `DELETE /api/staff/:id`
Removes the record. Appends an audit log entry.

**Position codes**

| Code | Thai label | Permissions |
|---|---|---|
| `nurse` | พยาบาล | View own schedule only |
| `scheduler` | หัวหน้าพยาบาล | View/edit schedules, approve requests, manage staff, audit logs |
| `admin` | ผู้ดูแลระบบ | All permissions + system settings |

---

## Audit Logs (mock CSV)

Data lives in `data/audit-logs.csv`. Append-only — rows are never deleted.

### `GET /api/audit-logs`
Returns all log entries newest-first.
```json
{ "ok": true, "logs": [{ "timestamp": "...", "actorId": "1", "actorName": "Admin", "action": "CREATE_STAFF", "targetType": "staff", "targetId": "EMP009", "detail": "..." }] }
```

### `GET /api/audit-logs?export=csv`
Streams the raw CSV file as a download attachment.
`Content-Disposition: attachment; filename="audit-logs-<timestamp>.csv"`

### `POST /api/audit-logs`
Manually append a log entry (actor is taken from the session cookie).
```json
{ "action": "APPROVE_REQUEST", "targetType": "request", "targetId": "REQ001", "detail": "Approved shift swap" }
```

