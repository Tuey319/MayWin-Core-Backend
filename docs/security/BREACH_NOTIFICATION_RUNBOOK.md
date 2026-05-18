# Breach Notification Runbook
**MayWin Nurse Scheduling System**
**Version:** 1.0
**Effective date:** May 2026
**Document owner:** ISMS Manager
**Regulatory basis:** PDPA B.E. 2562 §37 — notification to PDPC within 72 hours of breach awareness

---

## 1. Purpose

This runbook defines the step-by-step procedure for detecting, containing, assessing, and notifying the relevant authorities following a personal data breach affecting MayWin. It is the primary operational reference for the on-call response team.

The 72-hour clock starts from the moment the team becomes **aware** that a breach has occurred — not from the moment the breach began. Partial notification is acceptable if full information is not yet available; it must be followed up promptly.

---

## 2. How to Detect a Breach

Monitor the following signals:

### 2.1 CloudWatch Alarms
- Spike in 4xx or 5xx responses on the backend Lambda
- Unexpected `PutObject` or `GetObject` calls to S3 from unrecognised principals
- RDS connection attempts from IP ranges outside the VPC
- Secrets Manager access from outside the Lambda execution role ARN

### 2.2 Application Audit Logs (`/api/audit-logs`)
- Multiple `LOGIN_FAILED` events against a single account within a short window (brute force)
- `GDPR_ERASURE_REQUEST` or `GDPR_ERASURE_COMPLETE` events not initiated by a known Hospital Admin
- Audit log entries with unexpected `actorId` values
- Unusual volume of `EXPORT_SCHEDULE` events outside business hours

### 2.3 Application Behaviour
- Session cookies accepted without a valid HMAC signature (indicates `SESSION_SECRET` exposure)
- Webhook events arriving without a valid LINE HMAC signature passing verification
- Nurse data appearing in responses to requests by users who should not have access

### 2.4 External Reports
- Notification from AWS GuardDuty or Security Hub
- Report from a nurse or hospital admin of unexpected data access
- Report from LINE Corporation of suspicious API activity on the OA

---

## 3. Severity Classification

| Severity | Examples | Response SLA |
|---|---|---|
| **Critical** | Credentials exposed to public (GitHub, logs); database accessed by unauthorised external party; mass PII disclosure affecting ≥ 10 data subjects | Immediate — escalate within 1 hour |
| **High** | Single nurse record exposed to an unauthorised user; authentication bypass; audit log tampering detected; LINE webhook accepting unsigned requests | Same business day — escalate within 4 hours |
| **Medium** | Failed breach attempt detected and blocked; anomalous access pattern identified but no confirmed exfiltration | Next business day — document and review |

---

## 4. Response Steps

### Step 1 — Detect and Confirm

- Identify the source signal (CloudWatch, audit log, external report)
- Determine whether a breach has **occurred** (data accessed) or was merely **attempted** (blocked)
- Record the time of first awareness as `T0` — this starts the 72-hour clock for Critical/High severity
- Assign an incident ID in the format `INC-YYYY-NNN` (e.g. `INC-2026-002`)
- Open a secure incident log (private Slack channel or encrypted document) and record all actions with timestamps

### Step 2 — Contain

Take immediate containment actions to stop ongoing harm:

| Action | How |
|---|---|
| Revoke compromised credentials | AWS IAM Console — rotate access keys; AWS Secrets Manager — update secrets |
| Block a compromised user account | Set `is_active = false` on the User entity in RDS |
| Invalidate all sessions | Rotate `SESSION_SECRET` in Secrets Manager and redeploy Lambda (all existing cookies become invalid) |
| Block a LINE OA webhook | Set `LINE_CHANNEL_SECRET` to an invalid value temporarily to reject all incoming webhooks |
| Isolate a Lambda function | Remove the function URL or restrict the execution role in IAM |
| Restrict RDS access | Modify the RDS security group to deny inbound connections |

### Step 3 — Assess

Determine the full scope of the breach:

- Which data categories were involved? (names, LINE IDs, employee codes, schedule data, credentials)
- How many data subjects are affected?
- What was the method of access? (credential theft, injection, misconfiguration, insider)
- What period of time was the breach active?
- Was data exfiltrated or only accessed?
- Are audit logs intact, or were they tampered with?

Document all findings with evidence references (CloudWatch log group/stream, audit log timestamps, S3 access log entries).

### Step 4 — Notify the PDPC (within 72 hours of T0)

If personal data of Thai data subjects was involved, notify the PDPC using the template in Section 6.

**PDPC Contact:**
- Office of the Personal Data Protection Committee, Thailand
- Website: [https://www.pdpc.or.th](https://www.pdpc.or.th)
- Email: *(insert current PDPC notification email from pdpc.or.th)*
- Notification form: *(insert PDPC breach notification form URL)*

Notification must include (even if incomplete at T+72h):
1. Nature of the breach
2. Categories and approximate number of data subjects affected
3. Categories and approximate number of personal data records affected
4. Name and contact details of the data protection contact
5. Likely consequences of the breach
6. Measures taken or proposed to address the breach

If full information is not available within 72 hours, submit what is known and follow up with a supplementary notification.

### Step 5 — Notify Affected Data Subjects

If the breach is likely to result in high risk to the rights and freedoms of individual nurses, notify them without undue delay using the template in Section 7.

Factors indicating high risk: financial harm, identity theft risk, discrimination, significant distress.

Notification may be delayed if it would compromise law enforcement investigation — document the reason.

### Step 6 — Document Everything

- Complete the incident log with timestamps for every action taken
- Record the final assessment: data categories, number of subjects, root cause, containment actions
- Retain all evidence (CloudWatch exports, audit log exports, communication records) for a minimum of 3 years
- Update the risk register with lessons learned

---

## 5. Internal Escalation Chain

```
On-call engineer detects signal
        ↓
Dev Team Lead notified immediately (phone + Slack)
        ↓
ISMS Manager notified within 1 hour (Critical/High) or next business day (Medium)
        ↓
Hospital Admin notified if their organisation's data is affected
        ↓
ISMS Manager files PDPC notification (T0 + 72h deadline)
```

---

## 6. PDPC Notification Template

```
Subject: Personal Data Breach Notification — MayWin NSP — [Incident ID]

To: Office of the Personal Data Protection Committee

Organization: [Hospital/Organization name]
System: MayWin Nurse Scheduling System
Incident ID: [INC-YYYY-NNN]
Date/time of awareness: [T0 timestamp]
Date of this notification: [timestamp]

1. Nature of the breach:
   [Brief factual description — e.g. "Unauthorised access to nurse 
   scheduling records via a misconfigured API endpoint"]

2. Categories of personal data involved:
   [e.g. Names, LINE user IDs, employee codes, shift preference records]

3. Approximate number of data subjects affected:
   [Number or range]

4. Likely consequences:
   [e.g. Potential disclosure of shift preferences; no financial data involved]

5. Measures taken:
   [Containment actions taken, e.g. credentials rotated, sessions invalidated, 
   endpoint secured]

6. Data Protection Contact:
   Name: [ISMS Manager name]
   Email: [contact email]
   Phone: [contact phone]

Further information will be provided as the investigation continues.
```

---

## 7. Data Subject Notification Template

```
Subject: Important Notice Regarding Your Personal Data — MayWin

Dear [Nurse name / "Nurse" if name unknown],

We are writing to inform you that a security incident may have affected 
your personal data held in the MayWin nurse scheduling system.

What happened:
[Brief plain-language description of the breach — e.g. "An error in our 
system configuration may have allowed an unauthorised party to access 
scheduling records between [date] and [date]."]

What information was involved:
[e.g. Your name and shift preferences. No financial information, 
passwords, or health records were involved.]

What we have done:
[e.g. We identified and closed the vulnerability on [date]. We have 
rotated all credentials and reviewed our access controls.]

What you can do:
- If you believe any of your information has been misused, please 
  contact your head nurse or hospital administrator.
- You may request access to your personal data or its deletion by 
  contacting [Hospital Admin contact].

We sincerely apologise for this incident. If you have questions, 
please contact: [ISMS Manager email]

[Organisation name]
[Date]
```

---

## 8. Post-Incident Review

A post-incident review must be conducted within **30 days** of containment and must produce:

- Root cause analysis
- Timeline of events from breach start to containment
- Assessment of whether existing controls failed or were bypassed
- Specific remediation actions with owners and due dates
- Update to the risk register
- Lessons learned communicated to the full development team

**Reference:** INC-2026-001 — credential exposure detected during security audit in April 2026. The incident was contained within 4 hours, no data was exfiltrated, and the following controls were strengthened as a direct result: audit log injection restriction, BFF permission checks on individual staff endpoints, and hardcoded URL removal. Full post-incident review completed May 2026.

---

## 9. Related Documents

| Document | Location |
|---|---|
| Information Security Policy | `docs/security/INFORMATION_SECURITY_POLICY.md` |
| Audit Testing Procedure | `docs/security/AUDIT_TESTING_PROCEDURE.md` |
| Incident Response Plan | `INCIDENT_RESPONSE_PLAN.md` |
| Log Monitoring Guide | `LOG_MONITORING.md` |
