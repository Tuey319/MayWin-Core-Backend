# Information Security Roles and Responsibilities

**Control**: ISO/IEC 27002 A.5.2

This document defines the key roles and responsibilities for maintaining the security of the MayWin Core Backend.

## 1. Backend Engineer

**Responsibilities**:
- **Secure Code Development**: Write, test, and maintain application code that is resilient to common security vulnerabilities.
- **Implement Access Controls**: Correctly apply security decorators (`@Public()`, `@Roles()`) and guards (`JwtAuthGuard`, `RolesGuard`) to enforce the principle of least privilege on API endpoints.
- **Input Validation**: Implement and use Data Transfer Objects (DTOs) with `class-validator` to prevent injection and data-handling vulnerabilities.
- **Dependency Management**: Scan dependencies for known vulnerabilities using `npm audit` before adding or updating them.
- **Secrets Handling**: Ensure no secrets are hardcoded in the source code, adhering to the environment variable policy.

**Evidence / Key Components**:
- Source Code: `src/**/*.ts`
- Guards: `src/common/guards/jwt-auth.guard.ts`, `src/common/guards/roles.guard.ts`
- DTOs: `src/**/*.dto.ts`

## 2. Security Administrator

**Responsibilities**:
- **User Access Management**: Manage user roles and permissions within the application. While this is often done via a UI, the underlying mechanism is the responsibility of this role to oversee.
- **Access Review**: Periodically review user access rights to ensure they align with the principle of least privilege.
- **Security Log Review**: Monitor and review security logs for suspicious activity, as defined in `LOG_MONITORING.md`.
- **Policy Management**: Own and update security policies (e.g., `SECURITY_POLICY.md`, `PRIVACY_POLICY.md`).

**Evidence / Key Components**:
- RBAC System: `src/common/decorators/roles.decorator.ts`, `src/common/guards/roles.guard.ts`
- Logging: `src/common/interceptors/security-logger.interceptor.ts`

## 3. DevOps / Infrastructure Engineer

**Responsibilities**:
- **Environment Separation**: Maintain strict separation between development, testing, and production environments as per `ENVIRONMENT_POLICY.md`.
- **Secrets Management**: Securely manage and inject environment variables and secrets (e.g., `JWT_SECRET`, `DB_PASSWORD`) into the application environments.
- **Infrastructure Security**: Configure cloud infrastructure (e.g., AWS IAM Roles, S3 bucket policies, network security groups) according to the `CLOUD_SECURITY.md` policy.
- **Backup and Recovery**: Implement and test the database backup and restore procedures.
- **CI/CD Pipeline Security**: Integrate security checks (e.g., `scripts/validate-env.js`) into the deployment pipeline.

**Evidence / Key Components**:
- Scripts: `scripts/backup-db.sh`, `scripts/restore-db.sh`, `scripts/validate-env.js`
- Policies: `ENVIRONMENT_POLICY.md`, `CLOUD_SECURITY.md`, `BUSINESS_CONTINUITY_PLAN.md`
- Configuration: `docker-compose.yml`

## 4. Database Administrator (DBA)

**Responsibilities**:
- **Database Security**: Secure the PostgreSQL database, ensuring it is not exposed to the public internet and that access is restricted to the application server.
- **Schema Management**: Apply and manage database schema changes.
- **Data Integrity**: Ensure the integrity and availability of the database.
- **Performance Tuning**: Monitor and optimize database performance.

**Evidence / Key Components**:
- Schema: `src/database/schema/maywin_schema.sql`
- ORM Config: `src/database/typeorm.config.ts`
- Database System: PostgreSQL

## 5. Monitoring and Incident Response Team

**Responsibilities**:
- **Alert Monitoring**: Actively monitor for automated alerts indicating suspicious activity, as defined in `LOG_MONITORING.md`.
- **Incident Triage**: Perform initial analysis of security events to determine if they constitute an incident.
- **Incident Response**: Execute the incident response plan (`INCIDENT_RESPONSE_PLAN.md`) in the event of a security breach.
- **Forensic Analysis**: Analyze logs and artifacts to understand the scope and root cause of an incident.

**Evidence / Key Components**:
- Logging: `src/common/interceptors/security-logger.interceptor.ts`
- Plans: `LOG_MONITORING.md`, `INCIDENT_RESPONSE_PLAN.md`