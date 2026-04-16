# Environment Management Policy

**Control**: ISO/IEC 27001:2022 A.8.32, A.8.34

## 1. Purpose
This policy defines the requirements for separating development, testing, and production environments to reduce the risk of unauthorized access or changes to the production environment.

## 2. Environment Definitions
- **Development**: The environment used by engineers to write and test code on their local machines.
- **Testing (Staging)**: A shared environment that mirrors the production setup. Used for integration testing, QA, and user acceptance testing before a release.
- **Production**: The live environment that serves end-users.

## 3. Segregation
- The development, testing, and production environments must be logically and physically separate. They must not share infrastructure, databases, or credentials.
- **Evidence**: Different AWS accounts or, at a minimum, different VPCs should be used for production vs. non-production workloads.

## 4. Data Management
- **No Production Data in Non-Production**: Production data, especially data classified as **Confidential**, must never be copied to or used in testing or development environments.
- **Test Data**: Non-production environments must be populated using anonymized data or purpose-built seed scripts.
- **Evidence**: The `src/database/seeds/seed-from-json.ts` script provides a mechanism for seeding non-production databases with realistic but non-sensitive test data.

## 5. Secrets Management
- Each environment must have its own set of secrets (e.g., `JWT_SECRET`, `DB_PASSWORD`).
- Secrets must be managed via environment variables and must not be stored in source control.
- **Evidence**: The `scripts/validate-env.js` script ensures that required environment variables are present, enforcing a clean separation of configuration from code.

## 6. Access Control
- Access to the production environment is restricted to authorized personnel in the DevOps and Security Administrator roles.
- Developers should not have direct access to the production environment or its database.

## 7. Change Control
- All changes to the production environment must be deployed via an automated CI/CD pipeline after being successfully tested in the staging environment. Manual changes to production are prohibited except in emergency incident response scenarios.