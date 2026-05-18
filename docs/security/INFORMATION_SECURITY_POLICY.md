# Information Security Policy
**MayWin Nurse Scheduling System**
**Version:** 1.0
**Effective date:** May 2026
**Review frequency:** Annually
**Document owner:** ISMS Manager

---

## 1. Purpose and Scope

This policy establishes the information security objectives, responsibilities, and governance framework for the MayWin nurse scheduling system. It applies to all software components, infrastructure, data, and personnel involved in the development, deployment, and operation of MayWin, including the NestJS backend, Next.js BFF, LINE Messaging API integration, and all AWS cloud services.

MayWin processes the personal data of registered nurses employed by Thai hospitals, including names, employee codes, LINE identifiers, shift preferences, availability records, and schedule assignments. This processing is governed by the **Personal Data Protection Act B.E. 2562 (PDPA)** and the organisation's implementation of **ISO/IEC 27001:2022**.

---

## 2. Security Objectives

The organisation is committed to maintaining:

| Objective | Definition |
|---|---|
| **Confidentiality** | Nurse personal data is accessible only to authorised personnel with a demonstrated need, enforced through role-based access control and encrypted session management. |
| **Integrity** | Data is accurate and protected from unauthorised modification; all mutations are recorded in a tamper-evident audit log. |
| **Availability** | The scheduling system remains available during hospital operational hours; outages are responded to within defined recovery time objectives. |

---

## 3. Regulatory and Standards Framework

| Framework | Applicability |
|---|---|
| PDPA B.E. 2562 (Thailand) | Governs collection, use, disclosure, and cross-border transfer of nurse personal data |
| ISO/IEC 27001:2022 | Defines the Information Security Management System (ISMS) structure, controls, and audit requirements |
| AWS Shared Responsibility Model | Defines the division of security obligations between the organisation and AWS |

---

## 4. Security Responsibilities

### 4.1 ISMS Manager
- Owns and maintains the risk register, asset register, and compliance documentation
- Schedules and oversees annual policy reviews and internal audits
- Approves exceptions to security policy
- Coordinates breach notification to the PDPC under PDPA §37
- Acts as the primary contact for external security audits

### 4.2 Dev Team Lead
- Responsible for secure development practices across the NestJS backend and Next.js BFF
- Ensures dependency vulnerability scanning (`npm audit`) runs on every pull request
- Manages secret hygiene: no credentials committed to source control; all secrets stored in AWS Secrets Manager
- Reviews security-relevant code changes before merge
- Maintains the secure development lifecycle described in `CONTRIBUTING.md`

### 4.3 DevOps
- Responsible for AWS infrastructure security including IAM role least-privilege, S3 bucket policies, RDS network isolation, and CloudWatch log retention
- Manages the deployment pipeline and ensures production deployments are gated by CI status checks
- Maintains environment separation between production and staging
- Rotates infrastructure credentials on a defined schedule

### 4.4 Hospital Admin (per organisation)
- Responsible for data subject rights within their organisation: processing erasure requests, issuing access request responses
- Reviews audit logs at `audit.read.auth` level for anomalous login behaviour
- Manages user account lifecycle: account creation, deactivation, and role assignment for hospital staff

### 4.5 Head Nurse (per unit)
- Responsible for staff access management within their ward: approving unit membership, monitoring active accounts
- Monitors Gemini AI consent status for nurses under their supervision
- Is the first point of contact for nurses who wish to withdraw Gemini consent or request data access

---

## 5. Acceptable Use

All personnel with access to MayWin must:

- Use only their own authenticated credentials — credential sharing is prohibited
- Report suspected security incidents to the Dev Team Lead immediately
- Not attempt to access data outside their assigned role scope
- Not use production data in test or development environments

---

## 6. Policy Enforcement

Violations of this policy may result in access revocation, disciplinary action, and, where applicable, reporting to relevant authorities. Security incidents must be handled in accordance with the **Breach Notification Runbook** (`docs/security/BREACH_NOTIFICATION_RUNBOOK.md`).

---

## 7. Related Documents

| Document | Location |
|---|---|
| Breach Notification Runbook | `docs/security/BREACH_NOTIFICATION_RUNBOOK.md` |
| Transfer Impact Assessment | `docs/security/TRANSFER_IMPACT_ASSESSMENT.md` |
| Data Processing Agreements | `docs/security/DATA_PROCESSING_AGREEMENTS.md` |
| Audit Testing Procedure | `docs/security/AUDIT_TESTING_PROCEDURE.md` |
| Access Control Matrix | `ACCESS_CONTROL_MATRIX.md` |
| Threat Model | `THREAT_MODEL.md` |
| Developer Guide | `docs/official/BACKEND_DEVELOPER_GUIDE.md` |

---

## 8. Review and Approval

This policy is reviewed annually. Any significant change to the system's data processing scope, regulatory environment, or threat landscape may trigger an out-of-cycle review.

| Role | Name | Date |
|---|---|---|
| ISMS Manager | *(sign on review)* | May 2026 |
| Dev Team Lead | *(sign on review)* | May 2026 |
