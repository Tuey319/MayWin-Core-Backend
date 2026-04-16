# Information Security Policy

**Control**: ISO/IEC 27001:2022 A.5.1

## 1. Purpose
This document establishes the top-level Information Security Policy for the MayWin Core Backend. Its purpose is to protect the confidentiality, integrity, and availability of all information and assets associated with the service. This policy provides the management direction and support for information security in accordance with business requirements and relevant laws and regulations.

## 2. Scope
This policy and its supporting sub-policies apply to all personnel involved in the development, deployment, and maintenance of the MayWin Core Backend, and to all assets listed in the `ASSET_INVENTORY.md`.

## 3. Policy Statements

### 3.1. Governance and Roles
- Information security roles and responsibilities are defined and assigned to ensure accountability.
- **Evidence**: `docs/security/SECURITY_ROLES.md`

### 3.2. Asset Management
- All information, software, and infrastructure assets must be identified, inventoried, and assigned ownership.
- **Evidence**: `docs/security/ASSET_INVENTORY.md`

### 3.3. Access Control
- Access to information and application functions shall be controlled based on the principles of "default deny" and "least privilege".
- **Evidence**: Implemented via `JwtAuthGuard` and `RolesGuard`. See `src/common/guards/`.

### 3.4. Data Protection
- Information shall be classified and handled according to its sensitivity level. Personal data must be protected in accordance with the Thailand PDPA.
- **Evidence**: `docs/security/DATA_CLASSIFICATION.md`, `docs/security/PRIVACY_POLICY.md`

### 3.5. Cryptography
- Cryptographic controls shall be used to protect the confidentiality and integrity of sensitive data, both in transit and at rest.
- **Evidence**: TLS for data in transit (`docs/security/NETWORK_SECURITY.md`), `bcrypt` for passwords at rest (`src/auth/auth.service.ts`).

### 3.6. Secure Development and Operations
- Security shall be an integral part of the entire system lifecycle, from development to operations and maintenance.
- **Evidence**: `docs/security/ENVIRONMENT_POLICY.md`, `docs/security/CLOUD_SECURITY.md`

### 3.7. Logging and Monitoring
- Security-relevant events shall be logged and monitored to detect and respond to potential security incidents.
- **Evidence**: `docs/security/LOG_MONITORING.md`, `src/common/interceptors/security-logger.interceptor.ts`

### 3.8. Business Continuity
- The service shall be resilient to disruptions, with tested plans for backup and recovery.
- **Evidence**: `docs/security/BUSINESS_CONTINUITY_PLAN.md`

## 4. Policy Review
This policy and all supporting documentation will be reviewed at least annually or upon significant changes to the system architecture or threat landscape.