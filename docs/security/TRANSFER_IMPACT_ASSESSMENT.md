# Transfer Impact Assessment
**MayWin Nurse Scheduling System**
**Version:** 1.0
**Effective date:** May 2026
**Review frequency:** Annually or when transfer scope changes
**Document owner:** ISMS Manager
**Regulatory basis:** PDPA B.E. 2562 §40 — international data transfers

---

## 1. Purpose

This Transfer Impact Assessment (TIA) documents the legal basis, adequacy assessment, safeguards, and residual risk for each international transfer of personal data made by the MayWin system. MayWin collects and processes personal data of Thai nurses; any transfer of that data outside Thailand requires an appropriate legal basis under PDPA §40.

---

## 2. Transfer 1 — LINE Corporation (Japan)

### 2.1 Overview

| Field | Detail |
|---|---|
| **Recipient** | LINE Corporation, Tokyo, Japan |
| **Relationship** | Processor (data processed on behalf of MayWin) |
| **Transfer mechanism** | HTTPS API calls from MayWin backend to LINE Messaging API |

### 2.2 Data Transferred

| Data element | Nature | Sensitivity |
|---|---|---|
| LINE user ID | Pseudonymous identifier assigned by LINE | Low — cannot directly identify a nurse without the MayWin linking table |
| Outbound message content | Reply messages sent by MayWin to nurses (confirmation texts, consent prompts) | Low — system-generated, not personal data of the nurse |
| Inbound message content | Text typed by nurses in the LINE chat (shift preferences, leave requests) | Low-Medium — contains scheduling intent; no identifiers transmitted by the system |

### 2.3 Purpose of Transfer

To enable the nurse chatbot interface: nurses submit scheduling preferences and leave requests via LINE, and MayWin replies with confirmations. Consent prompts and postback events for Gemini AI consent are also handled through this channel.

### 2.4 Jurisdiction Assessment

| Factor | Assessment |
|---|---|
| **Jurisdiction** | Japan |
| **Data protection law** | Act on the Protection of Personal Information (APPI), as amended 2022 |
| **Adequacy** | Japan is recognised by the European Commission as providing adequate protection (2019 adequacy decision). While Thailand's PDPA does not maintain a formal adequacy list, Japan's APPI framework provides protections substantively equivalent to PDPA requirements. |
| **Regulatory authority** | Personal Information Protection Commission (PPC), Japan |

### 2.5 Safeguards

- LINE Terms of Service and Privacy Policy govern the handling of message data
- LINE Corporation is subject to APPI obligations including purpose limitation and security safeguards
- MayWin does not transmit nurse names, employee codes, or other direct identifiers to LINE beyond what nurses type themselves
- Conversation records in the MayWin database (`chatbot_conversations` table) are subject to a 90-day retention limit enforced by the `ChatbotCleanupService`

### 2.6 Risk Assessment

**Residual risk: Low**

LINE user IDs are pseudonymous — they identify a LINE account, not a person. The re-identification risk requires access to MayWin's `line_link_tokens` or `workers` table, which is protected by RBAC. Message content contains scheduling preferences, not sensitive health data. LINE Corporation's security posture and regulatory obligations under APPI provide adequate assurance.

### 2.7 Mitigation

- Explicit nurse consent obtained via LINE postback before any personal message is processed ([`webhook.service.ts:235–265`](../../src/core/webhook/webhook.service.ts))
- Nurses who decline consent are blocked from the chatbot; no further messages are processed
- 90-day automatic deletion of conversation records

---

## 3. Transfer 2 — Google LLC (United States — Gemini API)

### 3.1 Overview

| Field | Detail |
|---|---|
| **Recipient** | Google LLC, California, United States |
| **Relationship** | Processor (natural language processing service) |
| **Transfer mechanism** | HTTPS API calls from MayWin backend to Google Generative AI API |

### 3.2 Data Transferred

| Data element | Nature | Sensitivity |
|---|---|---|
| Raw message text | The plain text of a nurse's LINE message, e.g. "ขอเวรเช้าวันที่ 20 มีนาคม" | Low-Medium — contains scheduling intent typed by the nurse |

**What is NOT transferred to Google:**
- LINE user ID
- Nurse name or employee code
- Organisation or unit identifiers
- Any system-held personal identifier

The separation is enforced architecturally: the LINE userId is used only to look up the worker and conversation record; only the raw message string is passed to `callGemini()` ([`webhook.service.ts`](../../src/core/webhook/webhook.service.ts)). Any personal names a nurse includes in their own message text are incidental and user-initiated, not transmitted by the system.

### 3.3 Purpose of Transfer

Natural language understanding (NLU) for scheduling preference extraction. Gemini converts a nurse's natural language message into structured scheduling data (`{ date, shift }` objects) for saving to the database.

### 3.4 Jurisdiction Assessment

| Factor | Assessment |
|---|---|
| **Jurisdiction** | United States |
| **Data protection law** | No federal omnibus data protection law; California CCPA applies to California residents; sector-specific laws apply |
| **Adequacy** | The United States does not have a general adequacy recognition under PDPA. Transfer is justified by the Google Cloud Data Processing Addendum (DPA) as a contractual safeguard under PDPA §40(1) |
| **Regulatory authority** | Federal Trade Commission (FTC); California Privacy Protection Agency (CPPA) |

### 3.5 Safeguards

- **Google Cloud Data Processing Addendum**: must be accepted via Google Cloud Console before production deployment of the Gemini feature. The DPA provides contractual commitments on data handling, sub-processor management, deletion, security, and audit rights. See `docs/security/DATA_PROCESSING_AGREEMENTS.md`.
- **Consent gate**: a nurse's message is only passed to Gemini if `gemini_consent_given === true` on their worker record. The consent prompt clearly discloses that messages are processed by Google Gemini AI ([`webhook.service.ts:56–95`](../../src/core/webhook/webhook.service.ts))
- **Identifier separation**: LINE userId is never included in the Gemini prompt
- **Production guard**: Gemini is disabled in `NODE_ENV === 'production'` pending explicit sign-off; the structured parser fallback is used instead ([`webhook.service.ts:361–368`](../../src/core/webhook/webhook.service.ts))

### 3.6 Risk Assessment

**Residual risk: Low**

Only the text of a nurse's message reaches Google — no system-held identifiers. The data is scheduling intent (dates and shifts), not sensitive health information. Google is bound by its DPA obligations. The consent gate ensures no processing occurs without explicit nurse consent, satisfying PDPA §24 requirements for any sensitive or AI-processed data.

### 3.7 Mitigation

- Accept Google Cloud DPA before production Gemini deployment (see `DATA_PROCESSING_AGREEMENTS.md` — action required)
- Maintain consent gate: non-consenting nurses are never processed by Gemini
- Review Gemini API terms annually for changes to data retention or sub-processor arrangements

---

## 4. Transfer 3 — Amazon Web Services (Singapore — ap-southeast-1)

### 4.1 Overview

| Field | Detail |
|---|---|
| **Recipient** | Amazon Web Services EMEA SARL / AWS Asia Pacific, Singapore |
| **Relationship** | Processor (cloud infrastructure provider) |
| **Transfer mechanism** | All application data is stored and processed in AWS ap-southeast-1 (Singapore) |

### 4.2 Data Transferred

All operational data processed by MayWin:

| Data element | Service |
|---|---|
| Worker PII (names, LINE IDs, employee codes) | RDS (PostgreSQL) |
| Schedule and availability data | RDS |
| Audit log records | RDS |
| Avatar and artefact files | S3 |
| Application secrets (credentials, API keys) | Secrets Manager |
| Application logs | CloudWatch Logs |
| Session execution state (solver jobs) | Step Functions |

### 4.3 Purpose of Transfer

Cloud hosting, database storage, compute (Lambda), log aggregation, secrets management, and orchestration for all MayWin workloads.

### 4.4 Jurisdiction Assessment

| Factor | Assessment |
|---|---|
| **Jurisdiction** | Singapore |
| **Data protection law** | Personal Data Protection Act 2012 (PDPA Singapore); adequacy is widely recognised |
| **Adequacy** | Singapore is a mature data protection jurisdiction with a comprehensive PDPA framework. AWS infrastructure in ap-southeast-1 does not leave Singapore without explicit replication configuration, which is not enabled. |
| **Regulatory authority** | Personal Data Protection Commission (PDPC), Singapore |

### 4.5 Safeguards

- **AWS Data Processing Addendum**: accepted under the AWS Customer Agreement. Commits AWS to data handling obligations including sub-processor management, security controls, breach notification, deletion, and audit rights.
- **Encryption in transit**: all connections use TLS; the TypeORM configuration enforces `ssl.rejectUnauthorized: true` ([`typeorm.config.ts`](../../src/database/typeorm.config.ts))
- **Encryption at rest**: S3 server-side encryption (`AES256`) enforced on every write operation ([`s3-artifacts.service.ts`](../../src/database/buckets/s3-artifacts.service.ts)); RDS encryption at rest configured at the infrastructure level
- **IAM least privilege**: Lambda execution roles are scoped to required services only
- **Secrets management**: no credentials in source code; all secrets in AWS Secrets Manager

### 4.6 Risk Assessment

**Residual risk: Low**

Singapore is a recognised data protection jurisdiction with legal requirements equivalent in substance to Thai PDPA. AWS's contractual commitments and international security certifications (ISO 27001, SOC 2) provide strong assurance. Data is encrypted in transit and at rest.

### 4.7 Mitigation

- Review AWS DPA annually for changes to sub-processor list or commitments
- Confirm RDS encryption at rest in AWS console during each annual review
- Confirm CloudWatch log retention policy is set (recommended: 1 year)

---

## 5. Overall Assessment

| Recipient | Jurisdiction | Adequacy basis | Residual risk | Status |
|---|---|---|---|---|
| LINE Corporation | Japan | APPI framework; substantive equivalence | Low | Transfer justified |
| Google LLC | United States | Google Cloud DPA (contractual) | Low | Transfer justified — DPA acceptance required before production |
| Amazon Web Services | Singapore | AWS DPA (contractual); Singapore PDPA | Low | Transfer justified |

All three international transfers are covered by appropriate safeguards. The key outstanding action is formal acceptance of the Google Cloud Data Processing Addendum before the Gemini NLU feature is enabled in production.

---

## 6. Review Record

| Version | Date | Changes | Reviewer |
|---|---|---|---|
| 1.0 | May 2026 | Initial document | ISMS Manager |
