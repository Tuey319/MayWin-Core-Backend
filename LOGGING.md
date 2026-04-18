# MayWin — Logging & Audit Reference

> Covers what gets logged, where it goes, at what severity, and why.
> Relevant standards: ISO 27001 Annex A.12.4 (Event Logging), SOC 2 CC7.2, PDPA Section 37.

---

## 1. Two Log Destinations

| Destination | What goes there | Format | Retention |
|---|---|---|---|
| **CloudWatch / stdout** | Every HTTP request (access log) | Structured JSON, one line per request | Set at CloudWatch log group level (recommend 90 days) |
| **Audit CSV / S3** | Security-significant events only | CSV rows, org-scoped | Indefinite (append-only; delete requires admin) |

**Why two tiers?**
CloudWatch captures the full traffic picture needed by SIEM tools and incident response.
The audit CSV is a tamper-evident, compliance-scoped record of *who did what* to *which resource*, as required by ISO 27001 A.12.4 and PDPA Article 37. Not every HTTP request belongs in an audit trail — that would bury the signal.

---

## 2. Severity Scale (RFC 5424 / Syslog)

MayWin uses the RFC 5424 numeric severity scale. This is the same scale used by syslog, AWS CloudWatch, Datadog, Splunk, and most SIEM tools — it is the industry standard referenced by ISO 27001, SOC 2, and PCI-DSS.

| Level | Name | Meaning in this system |
|---|---|---|
| 0 | emergency | System unusable — reserved for catastrophic failure |
| 1 | alert | Immediate action required |
| 2 | critical | Critical condition — severe data loss risk |
| 3 | error | An operation failed; data may be affected |
| 4 | warning | Suspicious or anomalous activity (rate limits, bad auth) |
| 5 | **notice** | Normal but security-significant event (login, logout, signup) |
| 6 | informational | Routine operational event (staff CRUD) |
| 7 | debug | Internal diagnostic — development only |

**Lower number = more severe.** This is the opposite of Winston's old scale.

---

## 3. Audit Log Events

### Authentication (BFF — `may-win/src/app/api/auth/`)

| Action | Level | Why |
|---|---|---|
| `SIGNUP` | 5 notice | New account creation is security-significant; must be traceable for PDPA account lifecycle |
| `LOGIN` | 5 notice | Successful authentication — access point for the system; ISO 27001 A.9.4.2 requires logging |
| `OTP_VERIFIED` | 5 notice | Completion of 2FA step — confirms identity was asserted |
| `LOGOUT` | 5 notice | Normal session termination; not suspicious, but must be recorded for session audit trails |
| `LOGIN_FAILED` | 4 warning | Failed auth attempt — could indicate credential stuffing; ISO 27001 A.12.4 requires failure logging |
| `RATE_LIMIT_EXCEEDED` | 4 warning | Excessive attempts from one IP — anomalous, possible attack |

**Why is LOGOUT a notice (5), not a warning (4)?**
Logout is a healthy, expected event. A warning implies something suspicious happened. A nurse logging out at end of shift is not suspicious — it is correct behavior. Notice (5) means "normal but worth recording." Warning (4) is reserved for things that could indicate an attack or policy violation. Confusing the two inflates security alert noise.

### Staff / Worker Operations (BFF proxied to backend)

| Action | Level | Why |
|---|---|---|
| `CREATE_STAFF` | 5 notice | PII write — new person added to system |
| `UPDATE_STAFF` | 5 notice | PII write — personal data modified |
| `DELETE_STAFF` | 5 notice | PII deletion — PDPA Article 37 requires a record that data was removed |
| `CREATE_WORKER` | 5 notice | Scheduling entity created |
| `UPDATE_WORKER` | 5 notice | Scheduling entity modified |

### Authorization Failures (Backend middleware)

| Action | Level | Why |
|---|---|---|
| `HTTP_UNAUTHORIZED` | 4 warning | Request reached backend without valid JWT — unexpected in normal use |
| `HTTP_FORBIDDEN` | 4 warning | Valid JWT but insufficient role — could indicate privilege escalation attempt |
| `HTTP_SERVER_ERROR` | 3 error | 5xx response — something broke; needs investigation |

---

## 4. CloudWatch Access Log Fields

Every HTTP request to the backend emits one JSON line to `process.stdout`:

```json
{
  "ts": "2026-04-18T10:22:00.000Z",
  "type": "http_access",
  "method": "GET",
  "path": "/core/staff",
  "status": 200,
  "ms": 45,
  "ip": "203.0.113.42",
  "ua": "Mozilla/5.0 ...",
  "uid": "20",
  "org": "1",
  "email": "nurse@hospital.th",
  "outcome": "success"
}
```

| Field | Source | Why it's there |
|---|---|---|
| `ip` | `x-forwarded-for` (first hop) | Needed for geo-blocking, rate analysis, incident response |
| `ua` | `User-Agent` header (truncated to 200 chars) | Identifies client type; useful for detecting scrapers or unusual clients |
| `uid` / `org` / `email` | JWT payload (decoded without re-verification) | Ties each request to an identity without a DB lookup; essential for PDPA data access tracking |
| `outcome` | derived from HTTP status | Allows CloudWatch Logs Insights to count success vs failure rates |

The BFF (Next.js) also emits a similar access log for `/api/*` routes via `src/middleware.js`.

---

## 5. Role Visibility in Audit Log UI

The audit log viewer (`/v2/dashboard/logs`) filters entries by severity based on the viewer's role. This prevents low-privilege users from seeing debug-level noise or sensitive system internals.

| Role | Max level visible | Can see |
|---|---|---|
| NURSE | 5 (notice) | notice, warning, error, critical, alert, emergency |
| HEAD_NURSE | 6 (informational) | + informational |
| HOSPITAL_ADMIN | 6 (informational) | + informational |
| SUPER_ADMIN | 7 (debug) | everything |

---

## 6. What Is NOT Logged (Known Gaps)

| Gap | Risk | Tracked in |
|---|---|---|
| PII *read* access (GET /staff, GET /workers) | Cannot prove who accessed a nurse's personal data after the fact | `TODO-compliance.md` |
| Schedule read access | Cannot audit who viewed a completed schedule | `TODO-compliance.md` |
| Backend-side LOGIN_FAILED | Failed logins only logged at BFF; if backend is called directly, failures are silent | `TODO-compliance.md` |
| `departmentId` not in session | Department-level scope relies entirely on backend; BFF cannot enforce it | `TODO-compliance.md` |

These gaps are documented and accepted risks for the current development phase. They should be addressed before a PDPA audit or SOC 2 Type II assessment.

---

## 7. Storage Backends

### Local filesystem (development)
Audit logs written to `$AUDIT_LOG_DIR/<orgId>/audit-logs.csv` (default: `/tmp`).

### S3 (production)
When `MAYWIN_ARTIFACTS_BUCKET` is set, logs are appended to `s3://<bucket>/logs/<orgId>/audit-logs.csv`.
Each write is a read-then-append to keep the file as a single CSV.

### CloudWatch
All `process.stdout` output from Lambda is automatically forwarded to the Lambda's CloudWatch log group. No extra configuration needed.

---

*Last updated: 2026-04-18*
