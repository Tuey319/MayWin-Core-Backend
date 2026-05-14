# Data Processing Agreements — Acceptance Record
**MayWin Nurse Scheduling System**
**Version:** 1.0
**Last reviewed:** May 2026
**Next review:** May 2027
**Document owner:** ISMS Manager
**Regulatory basis:** PDPA B.E. 2562 §38 (processor obligations) and §40 (international transfers)

---

## 1. Purpose

This document records the Data Processing Agreements (DPAs) accepted with all third-party data processors used by MayWin. Under PDPA §38, the data controller must enter into a written agreement with each processor. This register constitutes the organisation's compliance record for that obligation.

A processor is any party that processes personal data on behalf of MayWin (the controller). Processors may only act on documented instructions from the controller and must provide sufficient guarantees of technical and organisational security measures.

---

## 2. Processor Register

---

### 2.1 Amazon Web Services

| Field | Detail |
|---|---|
| **Processor** | Amazon Web Services, Inc. / Amazon Web Services EMEA SARL |
| **Agreement name** | AWS Data Processing Addendum |
| **Incorporated under** | AWS Customer Agreement |
| **Agreement URL** | https://aws.amazon.com/agreement/ |
| **DPA URL** | https://d1.awsstatic.com/legal/aws-gdpr/AWS_GDPR_DPA.pdf |
| **Acceptance method** | Standard terms — automatically accepted upon AWS account creation and use of services |
| **Acceptance date** | Upon account creation (exact date to be recorded by DevOps) |
| **Status** | ✅ ACCEPTED — standard terms apply upon account creation |

**Services in scope:**

| AWS Service | Purpose |
|---|---|
| AWS Lambda | Backend API execution (NestJS via serverless-express) |
| Amazon RDS (PostgreSQL) | Primary database — worker data, schedules, audit logs |
| Amazon S3 | Artefact and avatar file storage |
| AWS Secrets Manager | Credential and API key storage |
| Amazon CloudWatch | Application and infrastructure logging |
| Amazon ECR | Container image registry |
| AWS Step Functions | Solver orchestration pipeline |

**Processor obligations confirmed under DPA:**
- Processing only on documented controller instructions
- Confidentiality obligations on all authorised personnel
- Notification of security incidents without undue delay
- Deletion or return of data on contract termination
- Audit rights and provision of necessary information for compliance demonstration
- Sub-processor management with equivalent obligations

**Review action:** Confirm DPA version has not changed during annual review. Check AWS DPA change log at the URL above.

---

### 2.2 Google LLC (Gemini API)

| Field | Detail |
|---|---|
| **Processor** | Google LLC, California, United States |
| **Agreement name** | Google Cloud Data Processing Addendum |
| **Agreement URL** | https://cloud.google.com/terms/data-processing-addendum |
| **Gemini API terms** | https://ai.google.dev/gemini-api/terms |
| **Acceptance method** | Must be accepted via Google Cloud Console before production use |
| **Status** | ⚠️ ACCEPTANCE REQUIRED before production deployment of Gemini NLU feature |

**Services in scope:**

| Google Service | Purpose |
|---|---|
| Gemini API (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemma-3-27b-it`) | Natural language understanding — converts nurse message text to structured scheduling data |

**⚠️ Required action before production deployment:**

1. Log in to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: **IAM & Admin → Settings** (or search "Data Processing Amendment")
3. Locate the **Google Cloud Data Processing Addendum**
4. Review and accept the terms
5. Record the acceptance date in this document and notify the ISMS Manager

Until this acceptance is recorded, the Gemini NLU feature must remain disabled in production (`NODE_ENV=production` guard in `webhook.service.ts` already enforces this).

**Processor obligations confirmed under DPA (upon acceptance):**
- Processing only for the specified NLU purpose
- Google as a processor for API-submitted data; standard Google terms govern other interactions
- Data deletion commitments
- Security obligations per Google's security certifications (ISO 27001, SOC 2, SOC 3)
- Sub-processor list maintained at https://cloud.google.com/terms/subprocessors

**Review action:** Annual review of Google Cloud DPA and Gemini API terms for changes to data retention, sub-processors, or processing purposes. Confirm acceptance has not lapsed.

---

### 2.3 LINE Corporation

| Field | Detail |
|---|---|
| **Processor** | LINE Corporation, Tokyo, Japan |
| **Agreement name** | LINE Business Connect Terms of Service |
| **Agreement URL** | https://terms2.line.me/official_account_terms_business |
| **LINE Messaging API terms** | https://developers.line.biz/en/terms-and-policies/ |
| **LINE Privacy Policy** | https://line.me/en/terms/policy/ |
| **Acceptance method** | Standard terms — accepted upon LINE Official Account creation and Messaging API activation |
| **Acceptance date** | Upon LINE OA creation (exact date to be recorded by Dev Team Lead) |
| **Status** | ✅ ACCEPTED — standard terms apply upon OA creation |

**Services in scope:**

| LINE Service | Purpose |
|---|---|
| LINE Messaging API (webhook) | Receiving nurse messages and sending replies via LINE chat |
| LINE Login / user ID system | Pseudonymous LINE user ID used to link nurse LINE accounts |

**Processor obligations under LINE Terms:**
- LINE processes message data to deliver messages between the OA and users
- LINE is subject to the Act on Protection of Personal Information (APPI), Japan
- Data retention governed by LINE's privacy policy
- LINE Corporation holds ISO 27001 certification for its services

**Review action:** Annual review of LINE Business Connect Terms and Privacy Policy. If LINE modifies data processing terms, assess impact and update Transfer Impact Assessment.

---

## 3. Processor Oversight

The ISMS Manager is responsible for:

- Maintaining this register and updating it when new processors are onboarded
- Conducting annual reviews of each processor's DPA, terms, and sub-processor list
- Escalating any material changes in processor terms to the Dev Team Lead for technical impact assessment
- Ensuring new third-party integrations are reviewed and a DPA is in place before the integration is deployed to production

**Onboarding a new processor:** Any new third-party service that will process MayWin personal data must be approved by the ISMS Manager, have a DPA accepted or negotiated, and be added to this register before production deployment.

---

## 4. Subprocessor Awareness

Each processor above may engage subprocessors. The controller acknowledges the following known subprocessor chains:

| Processor | Subprocessors |
|---|---|
| AWS | See https://aws.amazon.com/compliance/sub-processors/ |
| Google LLC | See https://cloud.google.com/terms/subprocessors |
| LINE Corporation | LINE's group companies and telecommunications partners as described in LINE Privacy Policy |

Any objection to a new subprocessor must be raised within the notice period specified in the relevant DPA.

---

## 5. Review Record

| Version | Date | Changes | Reviewer |
|---|---|---|---|
| 1.0 | May 2026 | Initial document | ISMS Manager |
