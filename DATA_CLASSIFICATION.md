# Data Classification Policy

**Control**: ISO/IEC 27002 A.5.12

This policy defines the classification levels for data handled by the MayWin Core Backend.

## 1. Classification Levels

- **Public**: Information intended for public consumption.
- **Internal**: Information accessible to all MayWin employees but not for public release.
- **Confidential**: Sensitive business information accessible on a need-to-know basis.
- **Restricted**: Highly sensitive data, including PII and health information, with strict access controls.
- **Secret**: Critical security credentials that could compromise the entire system if leaked.

## 2. Data Classification Matrix

| Data Type | Example | Classification | Justification |
| :--- | :--- | :--- | :--- |
| **User Profile** | User's full name, email address. | **Restricted** | Contains Personally Identifiable Information (PII). |
| **Password Hashes** | `password_hash` column in the `users` table. | **Restricted** | While hashed, a breach could lead to offline brute-force attacks. |
| **Schedule Assignments** | A specific nurse assigned to a specific shift. | **Confidential** | Sensitive operational data. Could be considered PII/PHI in some contexts. |
| **Audit Logs** | Security event logs from the application. | **Confidential** | Contains operational security information and user activity. |
| **JWT Access Tokens** | The `accessToken` returned on login. | **Confidential** | A short-lived credential that grants access to the API. |
| **Source Code** | The application's `.ts` files. | **Confidential** | Reveals business logic and potential vulnerabilities. |
| **Backup Files** | A `.sql` dump of the database. | **Restricted** | A complete copy of all production data. |
| **Configuration Secrets** | `JWT_SECRET`, `DB_PASSWORD`. | **Secret** | Compromise of these assets leads to total system compromise. |
| **API Documentation** | `API_REFERENCE.md`. | **Internal** | Describes system functionality but contains no live data. |