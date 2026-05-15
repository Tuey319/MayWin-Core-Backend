# Audit Testing Procedure
**MayWin Nurse Scheduling System**
**Version:** 1.0
**Effective date:** May 2026
**Document owner:** ISMS Manager
**Regulatory basis:** ISO/IEC 27001:2022 A.8.34 — Protection of information systems during audit testing

---

## 1. Purpose

This procedure ensures that security testing — including penetration testing, vulnerability scanning, load testing, and internal security audits — is conducted in a controlled manner that does not disrupt live hospital scheduling operations or expose real nurse personal data to test tooling.

All security testing must be conducted against a **dedicated staging environment** populated with **anonymised synthetic data**. Testing against the production environment is prohibited.

---

## 2. Scope

This procedure applies to all forms of security assessment conducted against MayWin, including:

| Activity | Description |
|---|---|
| Penetration testing | Simulated attacks against the BFF, backend API, and webhook handler |
| Vulnerability scanning | Automated scanning of endpoints, dependencies, and infrastructure |
| Load and stress testing | Performance testing under high message volume |
| Security code review | Manual review of source code for vulnerabilities |
| Infrastructure audit | Review of AWS IAM policies, RDS configuration, S3 bucket settings |
| Social engineering | Any testing of human processes (out of scope for technical team; requires ISMS Manager approval) |

---

## 3. Core Rule

> **All security testing must be conducted against the staging environment with synthetic data. Testing against the production environment or using real nurse personal data is strictly prohibited.**

---

## 4. Staging Environment Requirements

The staging environment must meet the following requirements before any testing begins:

### 4.1 Infrastructure Separation

| Requirement | Detail |
|---|---|
| Separate AWS account or environment | Staging must use distinct IAM credentials, Lambda functions, and RDS instances from production |
| Separate BACKEND_BASE_URL | The BFF staging deployment must point to the staging Lambda URL — never to the production Lambda URL |
| Separate secrets | `SESSION_SECRET`, `LINE_CHANNEL_SECRET`, `JWT_SECRET`, and all API keys must be distinct from production values |
| Separate CloudWatch log groups | Staging logs must not interleave with production logs |

### 4.2 Database Requirements

| Requirement | Detail |
|---|---|
| Synthetic nurse data only | The staging RDS instance must contain only generated test records |
| No real names | Worker `full_name` fields must be synthetic (e.g. "Test Nurse A", "พยาบาลทดสอบ 01") |
| No real email addresses | Use `@example.com` or `@test.invalid` domains only |
| No real LINE IDs | Use a pattern such as `U0000000000000000000000000000001` |
| No real employee codes | Use codes in a reserved test range (e.g. `TEST-001` through `TEST-999`) |

### 4.3 LINE Account Separation

| Requirement | Detail |
|---|---|
| Separate LINE OA | A test LINE Official Account must be used — never the production OA |
| Separate LINE channel credentials | `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` must be test OA credentials |

---

## 5. Pre-Test Checklist

Before any security testing session begins, complete and document the following checklist. The Dev Team Lead must confirm before testing starts.

```
Pre-Test Checklist — MayWin Security Testing
Date: _____________  Tester: _____________  Test type: _____________

[ ] BACKEND_BASE_URL is confirmed to point to staging Lambda, not production
    Staging URL: _____________________________________________
    Confirmed by: _____________

[ ] RDS instance confirmed as staging — run:
      SELECT full_name FROM maywin_db.workers LIMIT 5;
    Confirm all names are synthetic. Sample output: ___________________

[ ] LINE channel credentials confirmed as test OA
    OA name: _____________  Channel ID: _____________

[ ] Staging SESSION_SECRET and LINE_CHANNEL_SECRET differ from production
    Confirmed by: _____________

[ ] Dev Team Lead notified of testing start
    Notified at: _____________  Notified via: _____________

[ ] Scope and duration agreed:
    Scope: _____________________________________________
    Start: _____________  Planned end: _____________

[ ] Confirmed testing does NOT fall in the first week of the month
    (hospital scheduling period — restricted)
```

---

## 6. Prohibited Actions During Testing

The following actions are prohibited at all times during security testing:

| Prohibited action | Reason |
|---|---|
| Using real nurse personal data in test payloads | PDPA §33 — test data must not contaminate production controls; real data must not be exposed to test tooling |
| Sending requests to the production Lambda URL | Risk of disrupting live hospital scheduling |
| Connecting to the production RDS instance | Risk of data corruption or exposure |
| Testing during hospital scheduling periods (first week of each month) | Head nurses generate monthly schedules during this period; any disruption has direct patient care impact |
| Storing test findings, payloads, or sample responses in the production database | Test artefacts must remain in the staging environment or secure offline storage |
| Disclosing findings publicly before remediation | Responsible disclosure policy applies; share findings only with Dev Team Lead and ISMS Manager |

---

## 7. Post-Test Requirements

Following every security testing session:

### 7.1 Findings Report

Produce a findings report within **5 business days** containing:
- Date, duration, and scope of testing
- Tester name and organisation
- Methodology used
- Each finding with: title, severity (Critical / High / Medium / Low / Informational), description, evidence, and recommended remediation
- Executive summary suitable for the ISMS Manager

### 7.2 Findings Distribution

- Share the report with the **Dev Team Lead** and **ISMS Manager** only (not public, not in a public GitHub issue)
- The ISMS Manager adds findings to the **risk register** with target remediation dates

### 7.3 Remediation Tracking

- Dev Team Lead assigns findings to developers with due dates based on severity:
  - Critical: 48 hours
  - High: 7 days
  - Medium: 30 days
  - Low / Informational: next planned sprint

### 7.4 Re-test

A re-test of all Critical and High findings must be conducted after fixes are applied to confirm remediation is effective.

### 7.5 Environment Cleanup

After testing, the staging environment must be reviewed:
- Any accounts or data created by testers must be deleted
- Any credentials generated for testing must be rotated
- Staging logs must be reviewed for unexpected persistent access

---

## 8. Reference Incident

**INC-2026-001 — Credential exposure detected during security audit, April 2026**

During a routine security audit of the MayWin codebase, a hardcoded production Lambda URL was discovered in three BFF route files. If a developer had misconfigured their local environment, test traffic would have silently routed to the production backend. No actual data was exposed; the finding was contained and remediated within the same session.

Remediation applied:
- Hardcoded URLs replaced with a startup assertion that throws if `BACKEND_BASE_URL` is not set
- This procedure document created to prevent equivalent risks during future testing
- BFF permission gaps remediated; audit log injection restricted

This incident demonstrates the value of active security testing as a control. It was detected without requiring production access and was resolved before any real nurse data was at risk.

---

## 9. Required Manual Action — GitHub Branch Protection

The following change must be made manually in the GitHub repository settings. This cannot be automated and must be performed by the Dev Team Lead or a repository administrator.

```
GitHub Repository Settings → Branches → Add branch protection rule:

  Branch name pattern:   main
  
  ✅ Require a pull request before merging
     Required number of approvals: 1
     ✅ Dismiss stale pull request approvals when new commits are pushed
  
  ✅ Require status checks to pass before merging
     Required status checks:
       - security-audit-backend (npm audit)
       - security-audit-frontend (npm audit)
       - secret-scan (TruffleHog)
  
  ✅ Require branches to be up to date before merging
  ✅ Do not allow bypassing the above settings

→ Save changes
```

**ISO control closed by this action:** A.8.32 — Change Management. No code change reaches `main` without peer review and passing security checks.

**Action owner:** Dev Team Lead
**Target completion:** Before next production deployment

---

## 10. Related Documents

| Document | Location |
|---|---|
| Information Security Policy | `docs/security/INFORMATION_SECURITY_POLICY.md` |
| Breach Notification Runbook | `docs/security/BREACH_NOTIFICATION_RUNBOOK.md` |
| CI Pipeline | `.github/workflows/ci.yml` |
| Contributing Guide | `CONTRIBUTING.md` |
| Incident Response Plan | `INCIDENT_RESPONSE_PLAN.md` |

---

## 11. Review Record

| Version | Date | Changes | Reviewer |
|---|---|---|---|
| 1.0 | May 2026 | Initial document | ISMS Manager |
