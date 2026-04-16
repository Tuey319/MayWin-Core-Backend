# Information Security Policy

**Control**: ISO/IEC 27002 A.5.1

## 1. Purpose
This policy defines the rules for developing, deploying, and maintaining the MayWin Core Backend to protect the confidentiality, integrity, and availability of scheduling data.

## 2. Access Control
- **Default Deny**: All endpoints require authentication via a valid JWT by default. Public access must be explicitly granted via the `@Public()` decorator.
- **Least Privilege**: Users must only be granted the minimum roles necessary for their function (e.g., `NURSE`, `UNIT_MANAGER`, `ORG_ADMIN`).
- **Role-Based Access Control (RBAC)**: Privileged actions (e.g., creating sites, modifying organization settings) must be protected by the `RolesGuard` and restricted to appropriate roles.

## 3. Authentication & Secrets
- **Passwords**: All user passwords must be hashed using `bcrypt` with a sufficient work factor. Plaintext passwords must never be stored or logged.
- **Secrets**: All secrets (e.g., `JWT_SECRET`, `DB_PASSWORD`, cloud credentials) must be managed via environment variables and never hardcoded in the source.
- **JWT**: The `JWT_SECRET` must be at least 32 characters long and validated at startup.

## 4. Logging
- Security-relevant events must be logged, including login attempts, unauthorized access, and privileged actions.
- Logs must include the actor (user ID), action, timestamp, and result.
- Sensitive data (passwords, tokens) must be masked in all logs.

## 5. Change Management
- Changes to privileged endpoints, authentication logic, or security configurations must be reviewed by at least one other engineer.
- All dependencies must be scanned for vulnerabilities (`npm audit`) before being added or updated.

## 6. Data Handling
- Data classification must be followed as per `DATA_CLASSIFICATION.md`.
- Backups must be performed regularly as defined in `BACKUP.md`.

## 7. Incident Response
- All security incidents must be handled according to the `INCIDENT_RESPONSE_PLAN.md`.

## 8. Policy Review
This policy will be reviewed annually or upon significant changes to the system architecture.