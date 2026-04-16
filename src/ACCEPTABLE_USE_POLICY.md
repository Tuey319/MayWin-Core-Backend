# Acceptable Use of Information and Other Associated Assets

**Control**: ISO/IEC 27001:2022 A.5.10

## 1. Purpose
This policy defines the rules for the acceptable use of all information and assets associated with the MayWin Core Backend to protect their confidentiality, integrity, and availability.

## 2. Scope
This policy applies to all personnel, including developers, administrators, and operators, who have been granted access to the system's assets.

## 3. Policy
- **Authorized Use**: All information assets, including the source code, databases, and logs, must only be accessed and used for legitimate, authorized business purposes related to the development, maintenance, and security of the MayWin Core Backend.

- **Data Handling**: All data must be handled in accordance with its classification level as defined in `docs/security/DATA_CLASSIFICATION.md`. Confidential data, including all Personal Identifiable Information (PII), requires the highest level of care.

- **Security Controls**: Users must not attempt to disable, bypass, or circumvent any implemented security controls.
  - **Evidence**: This includes security mechanisms such as the `JwtAuthGuard` for authentication and the `RolesGuard` for authorization.

- **Credential Management**: Users are responsible for safeguarding their credentials. Credentials must not be shared.

- **Prohibited Activities**:
  - Introducing malicious code or software.
  - Using production data in non-production environments, as per `docs/security/ENVIRONMENT_POLICY.md`.
  - Accessing data or systems for which authorization has not been explicitly granted.

- **Reporting**: All users are required to report any observed security weaknesses or potential incidents to the Incident Response Team as per the `docs/security/INCIDENT_RESPONSE_PLAN.md`.