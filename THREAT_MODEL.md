# Threat Model

**Control**: ISO/IEC 27002 A.5.7

This document outlines key threats to the MayWin Core Backend and the primary controls in place to mitigate them.

| Threat ID | Threat Description | Potential Impact | Mitigating Controls |
| :--- | :--- | :--- | :--- |
| **T-01** | **Unauthorized Schedule Access/Modification** | A malicious actor views or alters nurse schedules, causing operational disruption or privacy breaches. | `JwtAuthGuard` (A.8.5), `RolesGuard` (A.5.15), Unit/Org scope checks in services. |
| **T-02** | **Brute-Force Login Attempts** | An attacker guesses user passwords, leading to account compromise. | `ThrottlerModule` rate limiting on `/auth/login` (A.8.20), strong password policy (`SignupDto`), secure password hashing (`bcrypt`) (A.5.17). |
| **T-03** | **Privilege Escalation** | A standard user (e.g., `NURSE`) gains administrative (`ORG_ADMIN`) privileges. | Public signup endpoint explicitly blocks privileged role assignment (A.8.2). `RolesGuard` protects admin-only endpoints. |
| **T-04** | **Leaked JWT Secret** | An attacker obtains the `JWT_SECRET` and can forge valid tokens for any user. | `JWT_SECRET` is managed via environment variables, not checked into git (A.8.9). Startup validation (`validate-env.js`) enforces secret complexity (A.8.24). |
| **T-05** | **Data Loss due to Database Failure** | Hardware failure, corruption, or accidental deletion leads to permanent loss of scheduling data. | Automated backup scripts (`backup-db.sh`) and documented restore procedures (`restore-db.sh`, `BACKUP.md`) (A.8.13). |
| **T-06** | **Denial of Service (DoS)** | The API becomes unresponsive due to an overwhelming number of requests. | Global rate limiting via `ThrottlerModule` (A.8.20). Infrastructure-level protections (e.g., WAF, load balancer) are assumed for production. |
| **T-07** | **Insecure Direct Object Reference (IDOR)** | A user accesses data outside their authorized scope (e.g., a nurse in Org A views schedules for Org B). | All data access services must scope queries by `organizationId` or `unitId` from the user's JWT payload. |
| **T-08** | **Vulnerable Dependencies** | A third-party package (e.g., from `npm`) contains a known vulnerability that can be exploited. | `npm audit` is required as part of the change management process. Use of `helmet` mitigates common web vulnerabilities (A.8.7). |