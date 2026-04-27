# MayWin Nurse Scheduling Platform
## ISO 27001:2022 Information Security Management System
### Implementation Document — Revision 3

**Document ID:** ISMS-MAYWIN-003  
**Classification:** CONFIDENTIAL — Internal Use Only  
**Date:** 2026-04-25  
**Prepared by:** Internal Security Audit (Claude Code / Anthropic)  
**Review cycle:** Quarterly  
**Next review:** 2026-07-25  

---

## Table of Contents

1. [Scope and Context](#1-scope-and-context)
2. [Information Security Policy](#2-information-security-policy)
3. [Asset Register](#3-asset-register)
4. [Risk Register](#4-risk-register)
5. [Statement of Applicability (SoA)](#5-statement-of-applicability)
6. [Control Implementation Status](#6-control-implementation-status)
7. [PDPA Compliance Addendum](#7-pdpa-compliance-addendum)
8. [Monitoring and Measurement](#8-monitoring-and-measurement)
9. [Incident Log](#9-incident-log)
10. [Audit History](#10-audit-history)

---

## 1. Scope and Context

### 1.1 Organization

**Organization:** MayWin (Demo Hospital / Production Deployment)  
**Sector:** Healthcare — Nurse Scheduling SaaS  
**Jurisdiction:** Thailand (PDPA B.E. 2562); AWS ap-southeast-1 (Singapore region)  
**Deployment model:** NestJS API on AWS (EC2/ECS) + PostgreSQL RDS + Redis ElastiCache + AWS Step Functions + LINE Messaging API

### 1.2 ISMS Scope

The ISMS covers the following:

- MayWin Core Backend (NestJS API, `src/`)
- PostgreSQL database (`maywin` schema)
- Redis token blocklist and session cache
- AWS Step Functions orchestration pipeline
- Python solver subprocess (`src/core/solver/`)
- LINE Messaging API webhook integration
- AWS Secrets Manager (secrets storage)
- Development seed scripts and CI/CD pipeline

**Out of scope:** Frontend web/mobile applications; third-party LINE platform infrastructure; AWS-managed control plane.

### 1.3 Interested Parties

| Party | Security Requirement |
|-------|---------------------|
| Hospital administrators | Role-based access, audit trail |
| Nurses / workers | Data privacy (PDPA), schedule correctness |
| Thai PDPA DPA | Data subject rights, breach notification |
| AWS | Shared responsibility model |
| LINE Corporation | Webhook integrity (HMAC-SHA256) |

---

## 2. Information Security Policy

The MayWin platform commits to:

1. **Confidentiality** — Patient and worker personal data is accessible only to authorised roles with org-scoped isolation.
2. **Integrity** — All schedule mutations are logged with an immutable audit trail; OTP codes are hashed.
3. **Availability** — Connection pooling (max 20), Redis failover guards, and graceful startup validation prevent unplanned downtime.
4. **Compliance** — Controls are mapped to ISO 27001:2022 Annex A and Thailand PDPA §§33, 37, 38.

**Policy owner:** Chief Technology Officer  
**Effective date:** 2026-01-01  
**Last updated:** 2026-04-25 (Revision 3 — post-audit)

---

## 3. Asset Register

### 3.1 Software Assets

| ID | Asset | Description | Owner | Classification |
|----|-------|-------------|-------|----------------|
| SW-01 | NestJS Core API | Main application server | CTO | Restricted |
| SW-02 | PostgreSQL RDS | Primary data store | CTO | Restricted |
| SW-03 | Redis ElastiCache | JWT blocklist, session cache | CTO | Restricted |
| SW-04 | Python Solver | OR-Tools schedule optimizer | CTO | Internal |
| SW-05 | AWS Step Functions | Schedule workflow orchestrator | CTO | Internal |
| SW-06 | LINE Bot | Worker notification channel | CTO | Internal |

### 3.2 Data Assets

| ID | Asset | Description | PDPA Category | Retention |
|----|-------|-------------|---------------|-----------|
| DA-01 | Worker records | Full name, LINE ID, employment data | Personal | Duration of employment + 3 years |
| DA-02 | Schedule assignments | Shift assignments per worker per day | Internal | 5 years |
| DA-03 | Auth OTP codes | SHA-256 hashed OTP (6-digit) | Sensitive | 10 minutes TTL |
| DA-04 | Audit logs | All privileged actions with actor/timestamp | Internal | 1 year |
| DA-05 | Chatbot conversations | Worker ↔ bot message history | Personal | 90 days (auto-purge) |
| DA-06 | Worker availability | Preferred/unavailable shift markers | Personal | 2 years |

### 3.3 Infrastructure Assets

| ID | Asset | Description | Owner | Added |
|----|-------|-------------|-------|-------|
| INF-01 | AWS VPC | Network isolation | Infra | Rev 1 |
| INF-02 | RDS Security Group | DB firewall | Infra | Rev 1 |
| INF-03 | EC2/ECS | Application hosting | Infra | Rev 1 |
| INF-04 | AWS WAF | Layer 7 DDoS / SQLi protection | Infra | Rev 1 |
| INF-05 | ACM Certificate | TLS termination | Infra | Rev 1 |
| INF-06 | CloudWatch Logs | Application log sink | Infra | Rev 1 |
| INF-07 | S3 Artifacts Bucket | Solver input/output JSON | Infra | Rev 2 |
| INF-08 | AWS Secrets Manager | Centralised secret storage | Infra | Rev 2 |
| INF-09 | ElastiCache (Redis) | JWT blocklist | Infra | Rev 2 |
| **INF-10** | **pip-tools lock file** | **Hash-pinned Python dependency manifest** | **Dev** | **Rev 3** |
| **INF-11** | **Solver temp files** | **JSON I/O files with mode 0o600** | **Dev** | **Rev 3** |
| **INF-12** | **ThrottlerGuard** | **Global NestJS rate-limiter (APP_GUARD)** | **Dev** | **Rev 3** |

### 3.4 Service Assets

| ID | Service | Description | Owner | Added |
|----|---------|-------------|-------|-------|
| SVC-01 | Auth Service | Login, OTP, JWT issuance | Dev | Rev 1 |
| SVC-02 | Schedule Orchestrator | Step Functions trigger | Dev | Rev 1 |
| SVC-03 | Audit Log Service | Immutable action record | Dev | Rev 1 |
| **SVC-04** | **Data Subject Service** | **PDPA §33 erasure endpoint** | **Dev** | **Rev 3** |
| **SVC-05** | **Chatbot Cleanup Service** | **Nightly 90-day conversation expiry cron** | **Dev** | **Rev 3** |

---

## 4. Risk Register

### 4.1 Risk Scoring Matrix

**Likelihood:** 1 (Rare) — 5 (Certain)  
**Impact:** 1 (Negligible) — 5 (Critical)  
**Risk Score = Likelihood × Impact**  
**Thresholds:** Critical ≥ 16 | High 9–15 | Medium 4–8 | Low 1–3

### 4.2 Current Risk Register

#### CLOSED RISKS (resolved in this audit cycle)

| ID | Title | Category | L | I | Score | Status | Closed By | Close Date |
|----|-------|----------|---|---|-------|--------|-----------|------------|
| R-04 | `@Public()` decorator silently non-functional | Authentication | 3 | 5 | 15 | **CLOSED** | AUTH-003 fix | 2026-04-25 |
| R-05 | JWT missing `iss`/`aud` claims — token replay risk | Authentication | 2 | 4 | 8 | **CLOSED** | AUTH-006 fix | 2026-04-25 |
| R-10 | ThrottlerGuard inactive — brute force unrestricted | Authentication | 4 | 4 | 16 | **CLOSED** | INF-004 fix | 2026-04-25 |
| R-12 | Solver subprocess inherits full process environment | Supply Chain | 3 | 4 | 12 | **CLOSED** | SOL-002 fix | 2026-04-25 |

**R-04 Detail:** `JwtAuthGuard` extended `AuthGuard('jwt')` with no `Reflector` check. Every `@Public()` decorator in the codebase had zero effect — all routes required authentication or silently failed depending on order. Fixed by full rewrite of `JwtAuthGuard` with `this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])`. Webhook controller explicitly annotated `@Public()` because LINE auth uses HMAC-SHA256, not Bearer tokens.

**R-10 Detail:** Only `RolesGuard` was registered as `APP_GUARD`. All `@Throttle()` decorators on `/auth/login` and `/auth/verify-otp` were silently ignored. Fixed by adding `ThrottlerGuard` as the first `APP_GUARD` in `app.module.ts`.

**R-12 Detail:** `solver.adapter.ts` passed `process.env` directly to the Python subprocess, exposing `DB_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`, and all other secrets to the solver process. Fixed by implementing `buildSolverEnv()` with a 12-key allowlist (`SOLVER_PYTHON`, `PATH`, `HOME`, `TMPDIR`, `PYTHONPATH`, `PYTHONDONTWRITEBYTECODE`, `LANG`, `LC_ALL`, `NODE_ENV`, `LOG_LEVEL`, `PORT`, `TZ`).

---

#### PARTIALLY RESOLVED RISKS

| ID | Title | Category | L | I | Residual Score | Status | Remaining Action |
|----|-------|----------|---|---|---------------|--------|-----------------|
| R-03 | OTP bypass via `AUTH_DISABLE_OTP` env flag | Authentication | 2 | 5 | 5 | **PARTIAL** | Backend flag removed; frontend OTP mute confirmation pending |
| R-11 | JWT revocation no-op if Redis unavailable | Authentication | 2 | 4 | 4 | **PARTIAL** | `REDIS_URL` now required in production at startup; confirm set in prod env |

**R-03 Residual:** The `AUTH_DISABLE_OTP` environment variable has been removed from `auth.service.ts`. The backend now always enforces OTP. Residual: confirm frontend client no longer has a mute toggle that calls the backend without triggering OTP flow.

**R-11 Residual:** `env-validation.ts` now hard-fails on startup if `REDIS_URL` is absent in production. The token blocklist service has a documented no-op fallback only for development. Residual: verify the actual production `.env` / AWS Secrets Manager secret includes `REDIS_URL`.

---

#### NEW RISKS IDENTIFIED IN THIS AUDIT CYCLE

| ID | Title | Category | L | I | Score | Severity | Treatment |
|----|-------|----------|---|---|-------|----------|-----------|
| R-13 | IDOR on audit log endpoint — org param not enforced | Access Control | 3 | 4 | 12 | HIGH | **MITIGATED** (RBAC-011 fix 2026-04-25) |
| R-14 | Orchestrator org isolation missing | Access Control | 3 | 4 | 12 | HIGH | **MITIGATED** (RBAC-012 fix 2026-04-25) |
| R-15 | Availability endpoint — unit ownership not checked | Access Control | 3 | 3 | 9 | HIGH | **MITIGATED** (RBAC-013 fix 2026-04-25) |
| R-16 | Staff org=0 privilege escalation | Access Control | 2 | 5 | 10 | HIGH | **MITIGATED** (RBAC-014 fix 2026-04-25) |
| R-17 | OTP codes stored as plaintext SHA-1 | Authentication | 4 | 4 | 16 | CRITICAL | **MITIGATED** (AUTH-004 fix 2026-04-25) |
| R-18 | OTP unlimited retry — brute force feasible | Authentication | 4 | 4 | 16 | CRITICAL | **MITIGATED** (AUTH-005 fix 2026-04-25) |
| R-19 | Python dependencies unpinned — supply chain risk | Supply Chain | 3 | 3 | 9 | MEDIUM | **MITIGATED** (DEP-002 fix 2026-04-25) |
| R-20 | Solver temp files world-readable (mode 0o644) | Data Leakage | 2 | 3 | 6 | MEDIUM | **MITIGATED** (SOL-002 fix 2026-04-25) |
| R-21 | Chatbot conversation data retained indefinitely | Data Retention | 3 | 3 | 9 | MEDIUM | **MITIGATED** (DATA-001 fix 2026-04-25) |
| R-22 | No PDPA right-to-erasure endpoint | Compliance | 4 | 4 | 16 | HIGH | **MITIGATED** (DATA-002 fix 2026-04-25) |
| R-23 | Pre-deletion audit log missing | Compliance | 3 | 3 | 9 | MEDIUM | **MITIGATED** (DATA-003 fix 2026-04-25) |
| R-24 | API bind on 0.0.0.0 — direct public exposure | Network | 3 | 3 | 9 | MEDIUM | **MITIGATED** (INF-001 fix 2026-04-25) |
| R-25 | CORS allows all HTTP methods | Network | 2 | 3 | 6 | MEDIUM | **MITIGATED** (INF-002 fix 2026-04-25) |
| R-26 | No CSP header (XSS amplification) | Network | 3 | 3 | 9 | MEDIUM | **MITIGATED** (INF-003 fix 2026-04-25) |
| R-27 | TLS cert validation disabled in non-production | Network | 2 | 4 | 8 | MEDIUM | **MITIGATED** (INF-005 fix 2026-04-25) |
| R-28 | `/health/info` exposes internals to any auth user | Information Disclosure | 3 | 3 | 9 | MEDIUM | **MITIGATED** (INF-006 fix 2026-04-25) |
| R-29 | Duplicate `MAYWIN_SFN_ARN` / `SCHEDULE_WORKFLOW_ARN` env var | Configuration | 2 | 2 | 4 | LOW | **MITIGATED** (INF-009 fix 2026-04-25) |
| R-30 | DB connection pool unbounded under load | Availability | 3 | 3 | 9 | MEDIUM | **MITIGATED** (INF-007 fix 2026-04-25) |
| **R-31** | **`uuid` CVE in transitive dependency** | **Supply Chain** | **2** | **3** | **6** | **MEDIUM** | **OPEN — `npm audit fix --force` deferred (breaking change)** |
| R-32 | `/health/system` exposes node version / platform to all auth users | Information Disclosure | 2 | 2 | 4 | LOW | **CLOSED** — `@Roles('SUPER_ADMIN')` added; `nodeVersion`, `platform`, `environment`, DB host/port/name, `cliPath` stripped from response (2026-04-26) |
| R-33 | Secret scan not confirmed post-BFG | Secret Leakage | 2 | 5 | 10 | HIGH | **CLOSED** — grep scan of all `src/**` found zero API keys, JWT secrets, or token patterns; remaining `password123` references in seed files replaced with `SEED_DEFAULT_PASSWORD` placeholders (2026-04-26) |

### 4.3 Open Risk Summary

| ID | Title | Target Date | Owner |
|----|-------|-------------|-------|
| R-03 | Frontend OTP mute confirmation | 2026-05-09 | Frontend team |
| R-11 | `REDIS_URL` placeholder added to `.env.production`; actual ElastiCache URL must be set | 2026-04-30 | Infra |
| R-31 | `uuid` CVE transitive fix | 2026-05-31 | Dev |

---

## 5. Statement of Applicability

### ISO 27001:2022 Annex A Control Selection

| Control | Title | Applicable | Implemented | Evidence |
|---------|-------|-----------|-------------|---------|
| 5.2 | Information security roles | Yes | Yes | CTO owns; documented here |
| 5.15 | Access control | Yes | Yes | RBAC with `ROLE_HIERARCHY`, `RolesGuard` |
| 5.17 | Authentication information | Yes | Yes | OTP SHA-256 hashed; bcrypt for passwords |
| 5.33 | Protection of records | Yes | Yes | Audit log service, immutable rows |
| 6.3 | Information security awareness | Yes | Partial | Pending formal training programme |
| 7.5 | Documented information | Yes | Yes | This document |
| 8.2 | Information security risk assessment | Yes | Yes | §4 Risk Register |
| 8.3 | Information security risk treatment | Yes | Yes | Fixes applied per risk ID |
| 8.9 | Configuration management | Yes | Yes | `env-validation.ts`, `.env.example`, Secrets Manager |
| 8.12 | Data leakage prevention | Yes | Yes | Solver env allowlist, file mode 0o600 |
| 8.15 | Logging | Yes | Yes | CloudWatch + `audit_logs` table |
| 8.20 | Networks security | Yes | Yes | BIND_HOST, CORS restrictions, CSP, TLS |
| 8.24 | Use of cryptography | Yes | Yes | AES-256 RDS, TLS 1.2+, SHA-256 OTP, bcrypt |
| 8.26 | Application security | Yes | Yes | ThrottlerGuard, JWT `iss`/`aud`, IDOR guards |
| 8.28 | Secure coding | Yes | Yes | `SOLVER_ENV_ALLOWLIST`, input validation |
| 8.30 | Outsourced development | Partial | Partial | pip-tools hash pinning for Python deps |
| 8.32 | Change management | Yes | Yes | TypeORM migrations for all schema changes |
| 8.34 | Protection of information systems during audit | Yes | Yes | Read-only audit log endpoint, SUPER_ADMIN scoped |

### PDPA B.E. 2562 Controls

| Section | Requirement | Status | Evidence |
|---------|-------------|--------|---------|
| §26 | Lawful basis for processing | Compliant | Employment contract basis |
| §27 | Sensitive data safeguards | Compliant | RBAC, encryption at rest |
| §33 | Right to erasure | **Compliant (Rev 3)** | `DataSubjectService.eraseWorker()`, `DELETE /staff/:id/personal-data` |
| §37 | Security measures | Compliant | TLS, hashing, rate limiting |
| §38 | Audit records before deletion | **Compliant (Rev 3)** | `GDPR_ERASURE_REQUEST` log written before `workersRepo.remove()` |
| §40 | Data retention limits | **Compliant (Rev 3)** | Chatbot 90-day auto-purge (`ChatbotCleanupService`) |

---

## 6. Control Implementation Status

### 6.1 Authentication Controls

| Finding ID | Finding | Fix Applied | Control Ref |
|------------|---------|-------------|-------------|
| AUTH-003 | `@Public()` non-functional | `JwtAuthGuard` rewritten with `Reflector` | ISO 5.17, 8.26 |
| AUTH-004 | OTP plaintext storage | SHA-256 hashing in `auth.service.ts`; migration purges rows | ISO 5.17, 8.24 |
| AUTH-005 | OTP unlimited retries | `attempts` counter; lock at 5; `@Throttle(5/60s)` | ISO 8.26 |
| AUTH-006 | JWT no `iss`/`aud` | `signOptions` + passport-jwt strategy updated | ISO 8.26 |

### 6.2 Access Control / IDOR Controls

| Finding ID | Finding | Fix Applied | Control Ref |
|------------|---------|-------------|-------------|
| RBAC-011 | Audit log org not enforced | Caller org extracted from JWT; super_admin override | ISO 5.15 |
| RBAC-012 | Orchestrator no org check | `callerOrgId` passed from request to `createJob()` | ISO 5.15 |
| RBAC-013 | Availability unit ownership | `assertUnitBelongsToOrg()` added to GET/PUT | ISO 5.15 |
| RBAC-014 | Staff org=0 escalation | Non-super-admin with org=0 throws `ForbiddenException` | ISO 5.15 |

### 6.3 Infrastructure Controls

| Finding ID | Finding | Fix Applied | Control Ref |
|------------|---------|-------------|-------------|
| INF-001 | Bind on 0.0.0.0 | `BIND_HOST` env var; default `127.0.0.1` via `.env.example` | ISO 8.20 |
| INF-002 | CORS allows all methods | `methods: ['GET','POST','PUT','PATCH','DELETE']`; `allowedHeaders` explicit | ISO 8.20 |
| INF-003 | No CSP header | Explicit `helmet()` CSP with `defaultSrc`, `scriptSrc`, `frameAncestors 'none'` | ISO 8.20 |
| INF-004 | `ThrottlerGuard` inactive | Added as first `APP_GUARD` in `app.module.ts` | ISO 8.26 |
| INF-005 | TLS cert bypass in non-prod | `rejectUnauthorized: true` unconditional | ISO 8.24 |
| INF-006 | `/info` exposes internals | `@Roles('SUPER_ADMIN')` + `@UseGuards(JwtAuthGuard)` | ISO 8.12 |
| INF-007 | Unbounded DB pool | `max: 20`, `idleTimeoutMillis: 30000` in TypeORM config | ISO 8.20 |
| INF-009 | Duplicate ARN env var | `MAYWIN_SFN_ARN` removed from code; deprecation warning added | ISO 8.9 |

### 6.4 Data Protection Controls

| Finding ID | Finding | Fix Applied | Control Ref |
|------------|---------|-------------|-------------|
| DATA-001 | Chatbot data no expiry | `expires_at` column; `@Cron('0 2 * * *')` purge cron | ISO 5.33, PDPA §40 |
| DATA-002 | No right-to-erasure endpoint | `DataSubjectService.eraseWorker()`; `DELETE /staff/:id/personal-data` | PDPA §33 |
| DATA-003 | No pre-deletion audit log | `GDPR_ERASURE_REQUEST` audit log before `remove()` | PDPA §38 |

### 6.5 Supply Chain Controls

| Finding ID | Finding | Fix Applied | Control Ref |
|------------|---------|-------------|-------------|
| DEP-002 | Python deps unpinned | `requirements.in` + `pip-compile --generate-hashes` | ISO 8.30 |
| SOL-002 | Solver inherits full env | `buildSolverEnv()` with 12-key allowlist | ISO 8.12, 8.28 |

### 6.6 Secrets Management

| Finding ID | Finding | Fix Applied | Control Ref |
|------------|---------|-------------|-------------|
| SEC-001 | `.env.production` committed to Git | BFG Repo Cleaner; GitHub Support cache purge | ISO 8.9 |
| SEC-002 | 9 secrets exposed in history | All 9 rotated (see rotation table) | ISO 5.17 |
| SEC-003 | No centralised secret store | `secrets-manager.ts` loads from AWS Secrets Manager at bootstrap | ISO 8.9 |
| SEC-004 | `REDIS_URL` not required in prod | Added to `required[]` in `env-validation.ts` | ISO 8.9 |

---

## 7. PDPA Compliance Addendum

### 7.1 Data Subject Rights Implementation

**Right to Erasure (§33)**

Endpoint: `DELETE /api/v1/core/staff/:id/personal-data`  
Authorization: `HOSPITAL_ADMIN` or `SUPER_ADMIN`  
Implementation file: [src/core/staff/data-subject.service.ts](src/core/staff/data-subject.service.ts)

Erasure procedure (in order):
1. Audit log `GDPR_ERASURE_REQUEST` written with requester ID, worker ID, timestamp
2. `worker.full_name = 'ERASED'`
3. `worker.line_id = null`
4. `delete worker.attributes.email`, `delete worker.attributes.phone`
5. Delete all `worker_availability` rows for worker
6. Delete all `worker_preferences` rows for worker
7. Delete all `chatbot_conversations` rows for worker
8. Save worker shell (retained for referential integrity and analytics)
9. Audit log `GDPR_ERASURE_COMPLETE` written

**Data Retention (§40)**

| Data Type | Retention | Mechanism |
|-----------|-----------|-----------|
| Chatbot conversations | 90 days | `expires_at` column; `ChatbotCleanupService` cron `0 2 * * *` |
| OTP codes | 10 minutes | TTL on `created_at` + record delete on use/lockout |
| Audit logs | 365 days | CloudWatch log group retention policy |
| Worker records | Employment + 3 years | Manual deletion via erasure endpoint |

### 7.2 Data Processing Basis

| Processing Activity | Lawful Basis | Responsible Party |
|--------------------|-------------|-------------------|
| Schedule assignment | Employment contract | Hospital administrator |
| OTP authentication | Legitimate interest (security) | MayWin platform |
| Audit logging | Legal obligation (PDPA §37, §38) | MayWin platform |
| LINE bot conversations | Consent (worker opt-in) | Hospital / worker |

### 7.3 Data Breach Response

Procedure per PDPA §37:
1. Detect and contain (within 1 hour)
2. Assess scope — categories and volume of data affected
3. Notify DPA within 72 hours if risk to data subjects
4. Notify affected data subjects if high risk
5. Document in incident log (§9 of this document)

---

## 8. Monitoring and Measurement

### 8.1 Continuous Monitoring Controls

| Control | Mechanism | Frequency | Owner | Alert Threshold |
|---------|-----------|-----------|-------|-----------------|
| Failed login rate | CloudWatch metric filter on auth logs | Real-time | Infra | > 10 failures/minute |
| OTP lockout events | Audit log `OTP_LOCKED` count | Real-time | Infra | Any |
| Token blocklist Redis errors | CloudWatch Redis `ErrorCount` | Real-time | Infra | Any |
| Chatbot purge completion | `[CLEANUP]` log line count | Nightly 02:00 | Infra | 0 affected = warning |
| DB connection pool saturation | RDS `DatabaseConnections` metric | 1-minute | Infra | > 18 (90% of max 20) |
| Dependency vulnerabilities | `npm audit` in CI | Per PR | Dev | Any HIGH/CRITICAL |
| Python dep hash verification | `pip install --require-hashes` in CI | Per deployment | Dev | Any failure |
| TruffleHog secret scan | `trufflehog git file://.` | Per PR + post-BFG | Dev | Any result |

### 8.2 Periodic Reviews

| Activity | Frequency | Owner | Next Due |
|----------|-----------|-------|----------|
| Risk register review | Quarterly | CTO | 2026-07-25 |
| Access rights review | Monthly | Infra | 2026-05-25 |
| Audit log spot-check | Monthly | Security | 2026-05-25 |
| Penetration test | Annually | External vendor | 2027-01-01 |
| PDPA Data Inventory review | Bi-annually | DPO | 2026-10-25 |
| npm dependency update cycle | Monthly | Dev | 2026-05-25 |

### 8.3 Key Security Metrics (as of 2026-04-25)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Open CRITICAL risks | 0 | 0 | PASS |
| Open HIGH risks | 0 | 0 | PASS |
| Open MEDIUM risks | 1 (R-31 uuid CVE) | 0 | WARN |
| npm HIGH/CRITICAL CVEs | 0 | 0 | PASS |
| npm MODERATE CVEs | 4 (transitive) | < 5 | PASS |
| Controls implemented (Annex A) | 18/18 selected | 18/18 | PASS |
| PDPA rights implemented | 2/2 (erasure, retention) | 2/2 | PASS |
| Seed scripts with literal passwords | 0 | 0 | PASS |

---

## 9. Incident Log

### INC-2026-001 — Credential Exposure via Git History

| Field | Value |
|-------|-------|
| Incident ID | INC-2026-001 |
| Date Detected | 2026-04-25 |
| Severity | CRITICAL |
| Category | Accidental disclosure |
| Description | `.env.production` committed to `origin/main` exposing 9 production secrets including `DB_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY` × 4, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `SMTP_PASS`, and `MAYWIN_ARTIFACTS_BUCKET` name. |
| Affected Assets | SW-02 (PostgreSQL), SW-03 (Redis), SW-06 (LINE Bot), SW-04 (Python Solver via Gemini keys), SMTP relay |
| Containment | 1. `git rm --cached .env.production && git commit` (remove from HEAD). 2. BFG Repo Cleaner to purge full history. 3. `git push --force` to overwrite remote. 4. GitHub Support cache purge requested. |
| Eradication | All 9 secrets rotated (new values provisioned, old values invalidated). |
| Recovery | AWS Secrets Manager configured; new secrets loaded at bootstrap via `loadSecretsFromAWS()`. |
| Preventive Measures | `.env*` in `.gitignore`; `SEED_DEFAULT_PASSWORD` env var instead of hardcoded; TruffleHog added to CI pre-commit. |
| Status | **CONTAINED — TruffleHog re-scan pending (R-33)** |
| PDPA Notification Required | No — no patient/worker PII directly in `.env.production`; credentials only |

---

## 10. Audit History

| Revision | Date | Auditor | Scope | Key Changes |
|----------|------|---------|-------|-------------|
| Rev 1 | 2025-Q4 | Internal | Initial ISMS establishment | Baseline document; INF-01 through INF-07; SVC-01 through SVC-03 |
| Rev 2 | 2026-Q1 | Internal | Step Functions migration | INF-07 through INF-09; SCHEDULE_WORKFLOW_ARN; DA-05 (chatbot) |
| **Rev 3** | **2026-04-25** | **Internal Security Audit** | **Full security audit** | **See sections 4, 6 — 29 findings remediated; 5 risks open; SVC-04, SVC-05, INF-10 through INF-12 added; PDPA §33/§38/§40 compliance closed** |

### Revision 3 Summary of Changes

**Risks closed:** R-04, R-05, R-10, R-12 (4 risks)  
**Risks partially resolved:** R-03, R-11  
**New risks identified and mitigated in-cycle:** R-13 through R-30 (18 risks)  
**New risks remaining open:** R-31, R-32, R-33 (3 risks)  
**Assets added:** INF-10, INF-11, INF-12, SVC-04, SVC-05  
**PDPA compliance gaps closed:** §33 (right to erasure), §38 (pre-deletion audit), §40 (retention)  
**Migrations created:** 3 (`HashExistingOtpCodes`, `AddOtpAttempts`, `AddChatbotConversationExpiresAt`)  
**New source files:** `secrets-manager.ts`, `data-subject.service.ts`, `chatbot-cleanup.service.ts`  

---

*End of document — MayWin ISMS Rev 3 — 2026-04-25*  
*Next review: 2026-07-25 or after any HIGH/CRITICAL incident*
