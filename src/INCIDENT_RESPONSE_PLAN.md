# Incident Response Plan

**Control**: ISO/IEC 27001:2022 A.5.24, A.5.26, A.5.27

## 1. Purpose
This plan outlines the procedures for responding to a security incident affecting the MayWin Core Backend. The goal is to manage the incident effectively, minimize its impact, and restore normal operations as quickly as possible.

## 2. Roles and Responsibilities
- **Incident Response Team**: The team defined in `docs/security/SECURITY_ROLES.md` is responsible for executing this plan.
- **Incident Lead**: A designated member of the team will lead the response for any given incident.

## 3. Incident Response Phases

### Phase 1: Preparation
- This plan, along with associated tools and access credentials, is maintained and reviewed annually.
- **Evidence**: This document, `LOG_MONITORING.md`, `BUSINESS_CONTINUITY_PLAN.md`.

### Phase 2: Identification
- An incident can be identified through automated alerts (from CloudWatch, etc.), user reports, or manual log review.
- All potential incidents are to be reported to the Incident Response Team immediately.
- **Evidence**: Alerts configured based on `docs/security/LOG_MONITORING.md`.

### Phase 3: Containment
- The primary goal is to limit the impact of the incident.
- **Actions**: Isolate affected systems (e.g., modify security groups), disable compromised user accounts, rotate credentials.

### Phase 4: Eradication
- The root cause of the incident is identified and removed.
- **Actions**: Patch vulnerabilities, remove malicious code, improve security configurations.

### Phase 5: Recovery
- Systems are restored to normal operation.
- **Actions**: Restore data from backups (`scripts/restore-db.sh`), redeploy clean application instances, and monitor closely for any signs of recurrence.

### Phase 6: Lessons Learned
- Within two weeks of incident closure, a post-mortem report will be created.
- The report will detail the incident timeline, impact, actions taken, and root cause.
- Recommendations for improving security controls and this plan will be created and tracked.

## 4. Incident Classification
| Severity | Description | Response Time |
| :--- | :--- | :--- |
| **Critical** | System-wide breach, major data loss/leak. | Immediate |
| **High** | Single system compromise, minor data leak. | < 1 hour |
| **Medium** | Limited impact, suspicious activity detected. | < 4 hours |
| **Low** | Minor policy violation, no active threat. | < 24 hours |