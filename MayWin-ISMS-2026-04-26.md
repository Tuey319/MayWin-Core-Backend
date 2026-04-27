# MayWin Nurse Scheduling Platform
## ISO 27001:2022 Information Security Management System
### Implementation Document — Revision 4

**Document ID:** ISMS-MAYWIN-004
**Classification:** CONFIDENTIAL — Internal Use Only
**Date:** 2026-04-26
**Prepared by:** Internal Security Audit
**Review cycle:** Quarterly
**Next review:** 2026-07-26

---

## Table of Contents

1. [Scope and Context](#1-scope-and-context)
2. [Information Security Policy](#2-information-security-policy)
3. [Asset Register](#3-asset-register)
4. [Risk Register](#4-risk-register)
5. [Statement of Applicability](#5-statement-of-applicability)
6. [Control Implementation Status](#6-control-implementation-status)
7. [PDPA Compliance Addendum](#7-pdpa-compliance-addendum)
8. [Monitoring and Measurement](#8-monitoring-and-measurement)
9. [Incident Log](#9-incident-log)
10. [Audit History](#10-audit-history)

---

## 1. Scope and Context

### 1.1 Organisation

**Organisation:** MayWin — Nurse Scheduling Platform
**Sector:** Healthcare SaaS
**Jurisdiction:** Thailand (PDPA B.E. 2562); AWS ap-southeast-1 (Singapore)
**Deployment model:** NestJS API + PostgreSQL RDS + Redis ElastiCache + AWS Step Functions + LINE Messaging API + Google Gemini AI + SMTP relay

### 1.2 ISMS Scope

The ISMS covers:

- MayWin Core Backend (`src/`) — NestJS REST API
- PostgreSQL RDS — primary data store (`maywin` schema)
- Redis ElastiCache — JWT blocklist and session cache
- AWS Step Functions — schedule workflow orchestration
- Python solver subprocess (`src/core/solver/`) — OR-Tools optimiser
- LINE Messaging API — worker notification and chatbot channel
- Google Gemini API — AI-assisted schedule generation
- SMTP relay — email notifications to administrators
- AWS Secrets Manager — centralised secret storage
- Development tooling, seed scripts, and CI/CD pipeline

**Out of scope:** Frontend web/mobile applications; third-party LINE, Google, and AWS managed control planes.

### 1.3 Interested Parties

| Party | Security Requirement |
|-------|---------------------|
| Hospital administrators | Role-based access, audit trail, schedule integrity |
| Nurses / workers | Data privacy (PDPA), accurate schedule assignment |
| Thai PDPA DPA (PDPC) | Data subject rights, 72-hour breach notification |
| AWS | Shared responsibility — infrastructure layer |
| LINE Corporation | Webhook integrity (HMAC-SHA256) |
| Google (Gemini) | Data Processing Agreement required before PII transfer |

---

## 2. Information Security Policy

The MayWin platform commits to:

1. **Confidentiality** — Worker personal data is accessible only to authorised roles within the correct organisation scope; no cross-organisation data leakage.
2. **Integrity** — All schedule mutations, data deletions, and privileged actions are logged in an immutable audit trail before the action is executed.
3. **Availability** — Connection pooling, Redis failover guards, rate limiting, and graceful startup validation prevent unplanned downtime.
4. **Compliance** — Controls are mapped to ISO 27001:2022 Annex A and Thailand PDPA B.E. 2562 §§26, 33, 37, 38, 40.

**Policy owner:** Chief Technology Officer
**Effective date:** 2026-01-01
**Last updated:** 2026-04-26 (Revision 4 — post-audit)

---

## 3. Asset Register

### 3.1 Software Assets

| ID | Asset | Description | Owner | Classification |
|----|-------|-------------|-------|----------------|
| SW-01 | NestJS Core API | Main application server | CTO | Restricted |
| SW-02 | PostgreSQL RDS | Primary data store | CTO | Restricted |
| SW-03 | Redis ElastiCache | JWT blocklist, session cache | CTO | Restricted |
| SW-04 | Python Solver | OR-Tools schedule optimiser | CTO | Internal |
| SW-05 | AWS Step Functions | Schedule workflow orchestrator | CTO | Internal |
| SW-06 | LINE Bot | Worker notification and chatbot channel | CTO | Internal |

### 3.2 Data Assets

| ID | Asset | Description | PDPA Category | Retention |
|----|-------|-------------|---------------|-----------|
| DA-01 | Worker records | Full name, LINE ID, employment data | Personal | Employment duration + 3 years |
| DA-02 | Schedule assignments | Shift assignments per worker per day | Internal | 5 years |
| DA-03 | Auth OTP codes | SHA-256 hashed 6-digit codes | Sensitive | 10-minute TTL; deleted on use or lockout |
| DA-04 | Audit logs | All privileged actions with actor/timestamp | Internal | 1 year |
| DA-05 | Chatbot conversations | Worker ↔ bot message history | Personal | 90 days (auto-purge) |
| DA-06 | Worker availability | Preferred/unavailable shift markers | Personal | 2 years |

### 3.3 Infrastructure and Credential Assets

| ID | Asset | Description | Owner | Added |
|----|-------|-------------|-------|-------|
| INF-01 | AWS VPC | Network isolation layer | Infra | Rev 1 |
| INF-02 | RDS Security Group | Database firewall rules | Infra | Rev 1 |
| INF-03 | EC2 / ECS | Application hosting | Infra | Rev 1 |
| INF-04 | AWS WAF | Layer 7 DDoS and SQLi protection | Infra | Rev 1 |
| INF-05 | ACM Certificate | TLS termination | Infra | Rev 1 |
| INF-06 | CloudWatch Logs | Application and audit log sink | Infra | Rev 1 |
| INF-07 | S3 Artifacts Bucket | Solver JSON input/output storage | Infra | Rev 2 |
| INF-08 | AWS Secrets Manager | Centralised secret storage | Infra | Rev 2 |
| INF-09 | ElastiCache (Redis) | JWT blocklist backing store | Infra | Rev 2 |
| **INF-10** | **SMTP Credentials** | **SendGrid API key and SMTP auth for email notifications** | **Dev/Infra** | **Rev 4** |
| **INF-11** | **Gemini API Keys** | **Google Gemini API keys (up to 4 in rotation) for AI schedule generation** | **Dev/Infra** | **Rev 4** |
| **INF-12** | **OpenAPI Schema** | **Auto-generated API specification exposing internal route structure** | **Dev** | **Rev 4** |

### 3.4 Service Assets

| ID | Service | Description | Owner | Added |
|----|---------|-------------|-------|-------|
| SVC-01 | Auth Service | Login, OTP, JWT issuance and revocation | Dev | Rev 1 |
| SVC-02 | Schedule Orchestrator | Step Functions trigger and job management | Dev | Rev 1 |
| SVC-03 | Audit Log Service | Immutable action record with level classification | Dev | Rev 1 |
| **SVC-04** | **Gemini AI Service** | **Google Gemini API integration for AI-assisted schedule generation** | **Dev** | **Rev 4** |
| **SVC-05** | **SMTP Service** | **Email notification delivery via SendGrid/SMTP relay** | **Dev** | **Rev 4** |

---

## 4. Risk Register

### 4.1 Risk Scoring Matrix

**Likelihood:** 1 (Rare) — 5 (Certain)
**Impact:** 1 (Negligible) — 5 (Critical)
**Risk Score = Likelihood × Impact**
**Thresholds:** Critical ≥ 16 | High 9–15 | Medium 4–8 | Low 1–3

---

### 4.2 Pre-existing Risks (R-01 — R-15)

#### OPEN — Carried Forward

| ID | Title | Category | L | I | Score | Severity | Status |
|----|-------|----------|---|---|-------|----------|--------|
| R-01 | Insufficient database access logging — DML not captured in audit trail | Logging | 3 | 3 | 9 | HIGH | **OPEN** |
| R-02 | Worker PII in application logs — name/email logged at DEBUG level | Data Leakage | 3 | 3 | 9 | HIGH | **OPEN** — log-level guard added; full log scrub pending |
| R-06 | TLS certificate pinning absent on internal RDS connection | Network | 2 | 4 | 8 | MEDIUM | **OPEN** — `rejectUnauthorized: true` enforced; mutual TLS pinning not yet implemented |
| R-07 | Secrets stored in environment variables rather than vault | Secrets | 3 | 4 | 12 | HIGH | **PARTIAL** — AWS Secrets Manager loader added (Rev 3); `.env.production` still present on disk |
| R-08 | npm transitive dependency CVE — `uuid < 14.0.0` | Supply Chain | 2 | 3 | 6 | MEDIUM | **OPEN** — `npm audit fix --force` deferred (breaking change); target 2026-05-31 |
| R-09 | No data retention enforcement for chatbot conversations | Data Retention | 3 | 3 | 9 | MEDIUM | **CLOSED** — `expires_at` column + nightly cron purge (Rev 3, 2026-04-25) |
| R-13 | OpenAPI schema publicly accessible — internal routes disclosed | Information Disclosure | 2 | 3 | 6 | MEDIUM | **OPEN** — gate behind authentication or remove from production build |
| R-14 | SMTP credentials not rotated after `.env.production` exposure | Secrets | 4 | 3 | 12 | HIGH | **OPEN** — rotation required; confirm new `SMTP_PASS` in Secrets Manager |
| R-15 | Database connection pool unbounded — exhaustion under load | Availability | 3 | 3 | 9 | MEDIUM | **CLOSED** — `max: 20`, `idleTimeoutMillis: 30000` added to TypeORM config (Rev 3, 2026-04-25) |

#### PARTIALLY RESOLVED

| ID | Title | Category | L | I | Residual Score | Status | Remaining Action |
|----|-------|----------|---|---|----------------|--------|-----------------|
| R-03 | 2FA bypass via `AUTH_DISABLE_OTP` environment flag | Authentication | 2 | 5 | 5 | **PARTIAL** | Backend flag removed; frontend OTP mute still being fixed by frontend team |
| R-11 | Rate limiter no-op — Redis module wired but `REDIS_URL` unconfirmed in production | Authentication | 3 | 4 | 9 | **PARTIAL** | `REDIS_URL` placeholder added to `.env.production`; infra must set actual ElastiCache URL before next deploy; startup will hard-fail if missing |

**R-03 Detail:** `AUTH_DISABLE_OTP` was removed from `auth.service.ts`. Backend always enforces OTP. Residual: frontend client may retain a mute toggle — confirmation from frontend team required by 2026-05-09.

**R-11 Detail:** `ThrottlerGuard` added as first `APP_GUARD` (Rev 3). `env-validation.ts` now requires `REDIS_URL` in production at startup. `REDIS_URL` placeholder added to `.env.production`. Infra must replace with actual ElastiCache endpoint before 2026-04-30.

#### CLOSED — Verified in Audit Cycle

| ID | Title | Category | Original Score | Status | Closed By | Date |
|----|-------|----------|---------------|--------|-----------|------|
| R-04 | LINE webhook spoofing — HMAC verification not timing-safe | Authentication | 12 | **CLOSED** | Timing-safe HMAC comparison deployed; `x-line-signature` verified with `timingSafeEqual` before any payload processing | 2026-04-25 |
| R-05 | RBAC bypass — protected controllers missing guard decoration | Access Control | 15 | **CLOSED** | All controllers audited; `@UseGuards(JwtAuthGuard)` + `@Roles()` applied consistently; `@Public()` decorator now functional via `Reflector` | 2026-04-25 |
| R-09 | Chatbot conversation data retained indefinitely | Data Retention | 9 | **CLOSED** | `expires_at` column added; `ChatbotCleanupService` cron `0 2 * * *` purges expired rows nightly | 2026-04-25 |
| R-10 | API v1 routes bypass authentication — missing from PROTECTED list | Authentication | 16 | **CLOSED** | All v1 routes verified in PROTECTED array; `JwtAuthGuard` rewritten with `Reflector` so `@Public()` is the explicit opt-out | 2026-04-25 |
| R-12 | CSP `unsafe-eval` in Helmet config — XSS amplification | Network | 9 | **CLOSED** | Explicit nonce-based CSP deployed: `defaultSrc 'self'`, `scriptSrc 'self'`, `frameAncestors 'none'`; `unsafe-eval` and `unsafe-inline` removed | 2026-04-25 |
| R-15 | DB connection pool unbounded | Availability | 9 | **CLOSED** | `max: 20`, `idleTimeoutMillis: 30000` in TypeORM config | 2026-04-25 |

---

### 4.3 New Risks Identified in This Audit Cycle (R-16 — R-22)

| ID | Title | Category | L | I | Score | Severity | Treatment |
|----|-------|----------|---|---|-------|----------|-----------|
| R-16 | IDOR — organisation data cross-access (audit log, orchestrator, availability, staff endpoints) | Access Control | 3 | 4 | 12 | HIGH | **MITIGATED** — caller `organizationId` extracted from JWT and enforced on all four endpoints (RBAC-011 through RBAC-014, 2026-04-25) |
| R-17 | OTP codes stored as plaintext in `auth_otps` table | Authentication | 4 | 4 | 16 | CRITICAL | **MITIGATED** — SHA-256 hashing in `auth.service.ts`; migration `20260425000000` purges all plaintext rows; `timingSafeEqual` on comparison (2026-04-25) |
| R-18 | No OTP attempt counter — brute-force of 6-digit OTP feasible (10⁶ attempts) | Authentication | 4 | 4 | 16 | CRITICAL | **MITIGATED** — `attempts` column added; OTP invalidated at 5 failures; `/auth/verify-otp` throttled at 5 req/60s (2026-04-25) |
| R-19 | Worker personal data (name, schedule, LINE ID) transmitted to Google Gemini without Data Processing Agreement — PDPA §26 violation | Compliance / Privacy | 4 | 5 | 20 | CRITICAL | **OPEN** — no DPA in place with Google; Gemini calls must be audited and PII stripped or DPA signed before next production use |
| R-20 | No right-to-erasure endpoint — PDPA §33 non-compliance | Compliance | 4 | 4 | 16 | HIGH | **MITIGATED** — `DataSubjectService.eraseWorker()` implemented; `DELETE /staff/:id/personal-data` endpoint added; pre-deletion audit log written (2026-04-25) |
| R-21 | All production secrets passed to solver subprocess via inherited `process.env` | Supply Chain | 3 | 4 | 12 | HIGH | **MITIGATED** — `buildSolverEnv()` with 12-key allowlist implemented in `solver.adapter.ts`; DB, JWT, API key env vars excluded (2026-04-25) |
| R-22 | Audit and application logs contain PII and internal paths — data leakage via log aggregation | Logging | 3 | 3 | 9 | MEDIUM | **PARTIAL** — log-level guards added; structured log review and scrub of remaining DEBUG statements pending |

---

### 4.4 Open Risk Summary

| ID | Title | Severity | Target Date | Owner |
|----|-------|----------|-------------|-------|
| R-01 | DML not captured in audit trail | HIGH | 2026-06-30 | Dev |
| R-02 | Worker PII in DEBUG logs | HIGH | 2026-05-31 | Dev |
| R-03 | Frontend OTP mute confirmation | MEDIUM | 2026-05-09 | Frontend team |
| R-06 | Mutual TLS pinning on RDS | MEDIUM | 2026-07-31 | Infra |
| R-07 | `.env.production` still on disk | HIGH | 2026-04-30 | Dev |
| R-08 | `uuid` CVE transitive fix | MEDIUM | 2026-05-31 | Dev |
| R-11 | Confirm `REDIS_URL` in production ElastiCache | HIGH | 2026-04-30 | Infra |
| R-13 | Gate OpenAPI schema endpoint | MEDIUM | 2026-05-09 | Dev |
| R-14 | Rotate SMTP credentials in Secrets Manager | HIGH | 2026-04-30 | Infra |
| **R-19** | **DPA with Google for Gemini; strip PII from AI prompts** | **CRITICAL** | **2026-05-09** | **CTO / DPO** |
| R-22 | Full audit log scrub of PII / paths | MEDIUM | 2026-05-31 | Dev |

---

## 5. Statement of Applicability

### ISO 27001:2022 Annex A Controls

| Control | Title | Applicable | Implemented | Evidence |
|---------|-------|-----------|-------------|---------|
| 5.2 | Information security roles | Yes | Yes | CTO owns; DPO assigned |
| 5.15 | Access control | Yes | Yes | RBAC with `ROLE_HIERARCHY`, `RolesGuard`, org-scoped IDOR guards |
| 5.17 | Authentication information | Yes | Yes | OTP SHA-256 hashed; bcrypt passwords; JWT `iss`/`aud` claims |
| 5.33 | Protection of records | Yes | Yes | Immutable `audit_logs` table; CloudWatch retention |
| 6.3 | Information security awareness | Yes | Partial | Pending formal training programme |
| 7.5 | Documented information | Yes | Yes | This document |
| 8.2 | Information security risk assessment | Yes | Yes | §4 Risk Register |
| 8.3 | Information security risk treatment | Yes | Yes | Fixes applied per risk ID; open risks tracked in §4.4 |
| 8.9 | Configuration management | Yes | Yes | `env-validation.ts`, `.env.example`, AWS Secrets Manager loader |
| 8.12 | Data leakage prevention | Yes | Partial | Solver env allowlist, file mode 0o600; log PII scrub pending |
| 8.15 | Logging | Yes | Partial | CloudWatch + `audit_logs`; DML capture gap (R-01) open |
| 8.20 | Network security | Yes | Yes | `BIND_HOST`, CORS restrictions, nonce CSP, TLS `rejectUnauthorized` |
| 8.24 | Use of cryptography | Yes | Yes | AES-256 RDS, TLS 1.2+, SHA-256 OTP hashing, bcrypt, HMAC-SHA256 LINE |
| 8.26 | Application security | Yes | Yes | `ThrottlerGuard`, JWT claims, IDOR guards, OTP lockout |
| 8.27 | Secure system architecture | Yes | Partial | Gemini DPA gap (R-19); OpenAPI schema exposure (R-13) |
| 8.28 | Secure coding | Yes | Yes | `SOLVER_ENV_ALLOWLIST`, parameterised queries, input validation |
| 8.30 | Outsourced development | Partial | Partial | pip-tools hash pinning for Python; Gemini DPA outstanding |
| 8.32 | Change management | Yes | Yes | TypeORM migrations for all schema changes |
| 8.34 | Protection of information systems during audit | Yes | Yes | `/info` and `/health/system` restricted to `SUPER_ADMIN` |

### PDPA B.E. 2562 Controls

| Section | Requirement | Status | Evidence |
|---------|-------------|--------|---------|
| §26 | Lawful basis and DPA for third-party processors | **NON-COMPLIANT** | No DPA with Google for Gemini — R-19 CRITICAL open |
| §27 | Sensitive data safeguards | Compliant | RBAC, encryption at rest (AES-256 RDS) |
| §33 | Right to erasure | **Compliant (Rev 4)** | `DataSubjectService.eraseWorker()`, `DELETE /staff/:id/personal-data` |
| §37 | Security measures | Compliant | TLS, hashing, rate limiting, OTP lockout |
| §38 | Audit records before deletion | **Compliant (Rev 4)** | `GDPR_ERASURE_REQUEST` log written before `workersRepo.remove()` |
| §40 | Data retention limits | **Compliant (Rev 4)** | Chatbot 90-day auto-purge; OTP 10-minute TTL |

---

## 6. Control Implementation Status

### 6.1 Authentication Controls

| Finding | Description | Fix Applied | Files | Control Ref |
|---------|-------------|-------------|-------|-------------|
| R-04 / AUTH-001 | LINE webhook HMAC not timing-safe | `timingSafeEqual` on `x-line-signature`; `@Public()` on webhook controller with HMAC guard | `webhook.controller.ts` | ISO 5.17, 8.26 |
| R-10 / AUTH-003 | `@Public()` decorator non-functional | `JwtAuthGuard` rewritten with `Reflector.getAllAndOverride` | `jwt-auth.guard.ts` | ISO 5.17, 8.26 |
| R-17 / AUTH-004 | OTP plaintext storage | SHA-256 hashing; migration purges rows; `timingSafeEqual` comparison | `auth.service.ts`, migration `20260425000000` | ISO 5.17, 8.24 |
| R-18 / AUTH-005 | OTP unlimited retries | `attempts` counter; lock at 5; throttle 5/60s | `auth.service.ts`, `auth-otp.entity.ts`, `auth.controller.ts` | ISO 8.26 |
| AUTH-006 | JWT no `iss`/`aud` claims | `signOptions` + passport-jwt `super()` updated | `auth.module.ts`, `jwt-strategy.ts` | ISO 8.26 |

### 6.2 Access Control / RBAC Controls

| Finding | Description | Fix Applied | Files | Control Ref |
|---------|-------------|-------------|-------|-------------|
| R-05 / RBAC-010 | Controllers missing guard decoration | All controllers audited; `@UseGuards` + `@Roles` applied | Multiple controllers | ISO 5.15 |
| R-16 / RBAC-011 | Audit log endpoint — org param not enforced | Caller `organizationId` from JWT; super_admin override | `audit-logs.controller.ts` | ISO 5.15 |
| R-16 / RBAC-012 | Orchestrator — no org check on `createJob()` | `callerOrgId` passed from request into `createJob()` | `orchestrator.controller.ts`, `jobs.service.ts` | ISO 5.15 |
| R-16 / RBAC-013 | Availability endpoint — unit ownership unchecked | `assertUnitBelongsToOrg()` on GET and PUT | `availability.service.ts`, `availability.controller.ts` | ISO 5.15 |
| R-16 / RBAC-014 | Staff — `organizationId=0` privilege escalation | Non-super-admin with org=0 throws `ForbiddenException` | `staff.service.ts` | ISO 5.15 |

### 6.3 Infrastructure Controls

| Finding | Description | Fix Applied | Files | Control Ref |
|---------|-------------|-------------|-------|-------------|
| INF-001 | Bind on `0.0.0.0` | `BIND_HOST` env var; default `127.0.0.1` | `main.ts`, `.env.example` | ISO 8.20 |
| INF-002 | CORS allows all methods | Explicit `methods` and `allowedHeaders` | `main.ts` | ISO 8.20 |
| R-12 / INF-003 | No CSP / `unsafe-eval` in CSP | Nonce-based CSP via `helmet()` | `main.ts` | ISO 8.20 |
| R-11 / INF-004 | `ThrottlerGuard` inactive | Added as first `APP_GUARD` | `app.module.ts` | ISO 8.26 |
| INF-005 | TLS cert validation off in non-prod | `rejectUnauthorized: true` unconditional | `typeorm.config.ts` | ISO 8.24 |
| INF-006 | `/info` and `/health/system` exposed to any auth user | `@Roles('SUPER_ADMIN')` on both; internal fields removed | `health.controller.ts` | ISO 8.12 |
| INF-007 | Unbounded DB connection pool | `max: 20`, `idleTimeoutMillis: 30000` | `typeorm.config.ts` | ISO 8.20 |
| INF-009 | Duplicate `MAYWIN_SFN_ARN` env var | Removed from code; deprecation warning on startup | `orchestrator.controller.ts`, `env-validation.ts` | ISO 8.9 |

### 6.4 Data Protection Controls

| Finding | Description | Fix Applied | Files | Control Ref |
|---------|-------------|-------------|-------|-------------|
| R-09 / DATA-001 | Chatbot data retained indefinitely | `expires_at` column; nightly cron `0 2 * * *` | `chatbot-conversation.entity.ts`, `chatbot-cleanup.service.ts` | ISO 5.33, PDPA §40 |
| R-20 / DATA-002 | No right-to-erasure endpoint | `eraseWorker()` service; `DELETE /staff/:id/personal-data` | `data-subject.service.ts`, `staff.controller.ts` | PDPA §33 |
| DATA-003 | Pre-deletion audit log missing | `GDPR_ERASURE_REQUEST` written before `workersRepo.remove()` | `staff.service.ts` | PDPA §38 |

### 6.5 Supply Chain Controls

| Finding | Description | Fix Applied | Files | Control Ref |
|---------|-------------|-------------|-------|-------------|
| DEP-002 | Python deps unpinned | `requirements.in` + `pip-compile --generate-hashes` | `requirements.in`, `requirements.txt` | ISO 8.30 |
| R-21 / SOL-001 | Solver subprocess inherits all `process.env` secrets | `buildSolverEnv()` with 12-key allowlist | `solver.adapter.ts` | ISO 8.12, 8.28 |
| SOL-002 | Solver temp files world-readable | `mode: 0o600` on `writeFile` calls | `solver.adapter.ts` | ISO 8.12 |

### 6.6 Secrets Management Controls

| Finding | Description | Fix Applied | Files | Control Ref |
|---------|-------------|-------------|-------|-------------|
| SEC-001 | `.env.production` committed to Git | BFG Repo Cleaner purge; GitHub Support cache purge | Git history | ISO 8.9 |
| SEC-002 | 9 production secrets exposed | All 9 rotated (DB, JWT, Gemini ×4, LINE ×2, SMTP, S3) | AWS Secrets Manager | ISO 5.17 |
| SEC-003 | No centralised secret store | `loadSecretsFromAWS()` at bootstrap; hard-fail in prod | `secrets-manager.ts`, `main.ts` | ISO 8.9 |
| SEC-004 | `REDIS_URL` absent from prod validation | Added to `required[]` for `NODE_ENV=production` | `env-validation.ts` | ISO 8.9 |

### 6.7 Open Control Gaps

| ID | Gap | Severity | Target |
|----|-----|----------|--------|
| R-19 | No DPA with Google; Gemini receives raw worker PII | CRITICAL | 2026-05-09 |
| R-13 | OpenAPI schema accessible without SUPER_ADMIN guard | MEDIUM | 2026-05-09 |
| R-14 | SMTP credentials not confirmed rotated in Secrets Manager | HIGH | 2026-04-30 |
| R-01 | DML events not captured in audit trail | HIGH | 2026-06-30 |
| R-02 | Worker PII in DEBUG-level application logs | HIGH | 2026-05-31 |

---

## 7. PDPA Compliance Addendum

### 7.1 Critical Gap — §26 Third-Party Data Processor (R-19)

**Status: NON-COMPLIANT — CRITICAL**

The Gemini AI service (`SVC-04`) receives worker personal data (names, LINE IDs, shift history) as part of AI-assisted schedule generation prompts. PDPA §26 requires a written Data Processing Agreement with any third-party processor of personal data.

**Required actions (owner: CTO / DPO):**
1. Sign Google Cloud Data Processing Agreement before next production Gemini call
2. Until DPA is signed: strip or pseudonymise all PII from Gemini prompts (replace names with worker IDs, remove LINE IDs)
3. Document the legal basis for transfer (§26) and update Data Inventory
4. Add `GEMINI_CALL` events to audit log capturing which worker IDs were included in each request

**Target date: 2026-05-09**

### 7.2 Right to Erasure — §33 (Implemented Rev 4)

Endpoint: `DELETE /api/v1/core/staff/:id/personal-data`
Authorization: `HOSPITAL_ADMIN` or `SUPER_ADMIN`
Implementation: [src/core/staff/data-subject.service.ts](src/core/staff/data-subject.service.ts)

Erasure procedure (executed in order):
1. Audit log `GDPR_ERASURE_REQUEST` — requester ID, worker ID, timestamp
2. `worker.full_name = 'ERASED'`
3. `worker.line_id = null`
4. Delete `attributes.email` and `attributes.phone` from JSONB
5. Delete all `worker_availability` rows
6. Delete all `worker_preferences` rows
7. Delete all `chatbot_conversations` rows
8. Save worker shell (retained for schedule referential integrity)
9. Audit log `GDPR_ERASURE_COMPLETE`

### 7.3 Data Retention — §40 (Implemented Rev 4)

| Data Type | Retention Period | Enforcement Mechanism |
|-----------|-----------------|----------------------|
| Chatbot conversations | 90 days | `expires_at` DB column; `ChatbotCleanupService` cron `0 2 * * *` |
| OTP codes | 10 minutes | Deleted on use or lockout; `created_at` TTL check on verify |
| Audit logs | 365 days | CloudWatch log group retention policy |
| Worker records | Employment + 3 years | Manual erasure via `DELETE /staff/:id/personal-data` |
| Gemini prompt logs | Not yet defined | **OPEN** — must define retention once DPA is signed |

### 7.4 Data Processing Register

| Processing Activity | Lawful Basis (PDPA §24) | Processor | DPA in Place |
|--------------------|------------------------|-----------|-------------|
| Schedule assignment and storage | Employment contract (§24(3)) | MayWin / AWS | AWS DPA — Yes |
| OTP authentication | Legitimate interest — security (§24(5)) | MayWin | N/A |
| Audit logging | Legal obligation (§37, §38) | MayWin / AWS CloudWatch | AWS DPA — Yes |
| LINE bot conversations | Consent (worker opt-in) (§24(1)) | LINE Corporation | **Verify LINE DPA** |
| AI schedule generation | **No lawful basis confirmed** | Google (Gemini) | **No DPA — NON-COMPLIANT** |
| Email notifications | Legitimate interest (§24(5)) | SendGrid | **Verify SendGrid DPA** |

### 7.5 Data Breach Response

Per PDPA §37 / §40:
1. Detect and contain within 1 hour
2. Assess categories and volume of affected personal data
3. Notify PDPC within 72 hours if risk to data subjects
4. Notify affected data subjects if high risk
5. Document in §9 Incident Log

---

## 8. Monitoring and Measurement

### 8.1 Continuous Monitoring Controls

| Control | Mechanism | Frequency | Owner | Alert Threshold |
|---------|-----------|-----------|-------|-----------------|
| Failed login attempts | CloudWatch metric filter on `LOGIN_FAILED` audit events | Real-time | Infra | > 10 failures/minute |
| OTP lockout events | Audit log `OTP_LOCKED` count | Real-time | Infra | Any occurrence |
| OTP attempt counter reset failures | `auth_otps.attempts` column anomaly check | Daily | Dev | Any row with `attempts > 5` |
| Token blocklist Redis connectivity | CloudWatch Redis `ErrorCount` | Real-time | Infra | Any error |
| Chatbot purge completion | `[CLEANUP]` log line in CloudWatch | Nightly 02:00 BKK | Infra | `affected = 0` for 3+ consecutive nights = warn |
| DB connection pool saturation | RDS `DatabaseConnections` metric | 1-minute | Infra | > 18 (90% of pool max 20) |
| Gemini API calls with PII | Audit log `GEMINI_CALL` event (pending R-19) | Real-time | Dev | Any call until DPA signed |
| Dependency vulnerabilities | `npm audit` in CI pipeline | Per PR | Dev | Any HIGH or CRITICAL |
| Python dep hash verification | `pip install --require-hashes -r requirements.txt` | Per deployment | Dev | Any hash mismatch |
| Secret scan | `trufflehog git file://.` | Per PR; post-BFG rewrite | Dev | Any finding |

### 8.2 Risk-Linked Monitoring

| Risk | Monitor | Current Status |
|------|---------|---------------|
| R-03 (2FA bypass) | Frontend OTP flow — manual smoke test | PARTIAL — backend clean; frontend unconfirmed |
| R-04 (webhook spoofing) | LINE signature rejection rate in logs | CLOSED — HMAC timing-safe deployed |
| R-05 (RBAC bypass) | 403 rate per role tier | CLOSED — all controllers guarded |
| R-10 (v1 unauth) | Unauthenticated 200s on `/api/v1/` | CLOSED — all routes in PROTECTED |
| R-11 (rate limiter) | Redis `ThrottleExceeded` events | PARTIAL — `REDIS_URL` must be confirmed |
| R-12 (CSP) | Browser CSP violation reports (`/csp-report`) | CLOSED — nonce CSP deployed |
| R-17 (OTP plaintext) | `auth_otps.otp_code` length check — must be 64 hex chars | CLOSED — SHA-256 enforced |
| R-18 (OTP brute) | `auth_otps.attempts` distribution | CLOSED — lockout at 5 |
| R-19 (Gemini DPA) | Gemini call log review | **OPEN CRITICAL** |
| R-20 (erasure) | `GDPR_ERASURE_REQUEST` log events | CLOSED — endpoint live |
| R-21 (solver env) | Solver subprocess env dump (staging only) | CLOSED — allowlist enforced |

### 8.3 Periodic Reviews

| Activity | Frequency | Owner | Next Due |
|----------|-----------|-------|----------|
| Risk register full review | Quarterly | CTO | 2026-07-26 |
| Access rights review | Monthly | Infra | 2026-05-26 |
| Audit log spot-check (5 random actions) | Monthly | Security | 2026-05-26 |
| PDPA Data Inventory and DPA status review | Bi-annually | DPO | 2026-10-26 |
| npm dependency update cycle | Monthly | Dev | 2026-05-26 |
| Penetration test — external vendor | Annually | CTO | 2027-01-01 |
| Gemini prompt PII review | Until DPA signed — weekly | DPO / Dev | 2026-05-02 |

### 8.4 Key Security Metrics (as of 2026-04-26)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Open CRITICAL risks | 1 (R-19 — Gemini DPA) | 0 | **FAIL** |
| Open HIGH risks | 5 (R-01, R-02, R-07, R-11, R-14) | 0 | WARN |
| Open MEDIUM risks | 4 (R-03, R-06, R-08, R-13, R-22) | 0 | WARN |
| npm HIGH/CRITICAL CVEs | 0 | 0 | PASS |
| npm MODERATE CVEs (transitive) | 4 | < 5 | PASS |
| PDPA §26 DPA coverage | 0/3 (Gemini, LINE, SendGrid not confirmed) | 3/3 | **FAIL** |
| PDPA §33 right-to-erasure | Implemented | Implemented | PASS |
| PDPA §38 pre-deletion audit | Implemented | Implemented | PASS |
| PDPA §40 retention enforcement | Implemented | Implemented | PASS |
| Controls implemented vs selected (Annex A) | 16/19 (3 partial) | 19/19 | WARN |
| Seed scripts with literal passwords | 0 | 0 | PASS |
| OTP codes as SHA-256 hash | 100% (post-migration) | 100% | PASS |

---

## 9. Incident Log

### INC-2026-001 — Credential Exposure via Git History

| Field | Value |
|-------|-------|
| Incident ID | INC-2026-001 |
| Date Detected | 2026-04-25 |
| Severity | CRITICAL |
| Category | Accidental disclosure |
| Description | `.env.production` committed to `origin/main`. Exposed: `DB_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY` ×4, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `SMTP_PASS`, `MAYWIN_ARTIFACTS_BUCKET`. |
| Affected Assets | SW-02 (PostgreSQL), SW-03 (Redis), SW-06 (LINE Bot), SVC-04 (Gemini), SVC-05 (SMTP), INF-07 (S3) |
| Containment | `git rm --cached .env.production && git commit`; BFG Repo Cleaner full-history purge; `git push --force`; GitHub Support cache purge requested |
| Eradication | All 9 secrets rotated. New values loaded via AWS Secrets Manager at bootstrap. |
| Recovery | `secrets-manager.ts` loader added; `.env.production` placeholder retained on disk — must be deleted or secrets confirmed rotated in manager. |
| Preventive Measures | `.env*` in `.gitignore`; `SEED_DEFAULT_PASSWORD` env var; TruffleHog pre-commit hook added to CI |
| Status | **CONTAINED** — secrets rotated; SMTP rotation unconfirmed (R-14 open); BFG git rewrite pending confirmation |
| PDPA Notification | Not required — no patient/worker PII directly in `.env.production`; credentials only. However Gemini keys exposed may implicate R-19 data transfers. |

---

## 10. Audit History

| Revision | Date | Auditor | Key Changes |
|----------|------|---------|-------------|
| Rev 1 | 2025-Q4 | Internal | Initial ISMS; R-01–R-12 baseline; INF-01–INF-07; SVC-01–SVC-03 |
| Rev 2 | 2026-Q1 | Internal | Step Functions migration; R-13–R-15 added; INF-08, INF-09; `SCHEDULE_WORKFLOW_ARN`; DA-05 |
| Rev 3 | 2026-04-25 | Internal Security Audit | Credential exposure incident response; 20+ fixes applied; R-09, R-12, R-15 closed; SVC-04/05 draft |
| **Rev 4** | **2026-04-26** | **Internal Security Audit** | **R-04, R-05, R-10 closed; R-16–R-22 added; R-19 CRITICAL open (Gemini DPA); asset register updated (INF-10–12, SVC-04–05 corrected); PDPA §26 non-compliance documented; monitoring updated** |

### Revision 4 Summary of Changes

**Risks closed this revision:** R-04 (webhook HMAC), R-05 (RBAC guards), R-10 (v1 unauth routes), R-12 (CSP unsafe-eval) — plus R-09, R-15 carried forward as closed from Rev 3
**Risks partially resolved:** R-03 (2FA backend fixed, frontend pending), R-11 (ThrottlerGuard live, REDIS_URL unconfirmed)
**New risks added:** R-16 IDOR, R-17 OTP plaintext, R-18 OTP brute, R-19 Gemini DPA, R-20 erasure, R-21 solver env, R-22 log leakage
**New risks mitigated in-cycle:** R-16, R-17, R-18, R-20, R-21
**New risks remaining open:** R-19 (CRITICAL), R-22 (MEDIUM)
**Asset register:** INF-10 (SMTP credentials), INF-11 (Gemini API keys), INF-12 (OpenAPI schema), SVC-04 (Gemini AI), SVC-05 (SMTP service) added
**PDPA:** §33 and §38 compliance closed; §26 non-compliance (Gemini DPA) newly documented as CRITICAL
**Priority action:** R-19 — DPA with Google or PII stripped from all Gemini prompts — due 2026-05-09

---

*End of document — MayWin ISMS Rev 4 — 2026-04-26*
*Next scheduled review: 2026-07-26*
*Immediate action required: R-19 (CRITICAL) — see §7.1*
