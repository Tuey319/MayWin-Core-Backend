# Separation of Development, Test, and Production Environments

**Control**: ISO/IEC 27002 A.8.31

This policy defines the rules for maintaining separation between different operational environments.

## 1. Environment Separation
- **Development**: A developer's local machine. Uses local configuration (`.env` file) and a local database.
- **Testing**: A shared environment for CI/CD and automated testing. Uses a dedicated test database and test-specific secrets.
- **Production**: The live environment serving end-users. Uses production-grade infrastructure and secrets.

## 2. Configuration and Secrets
- **Environment Variables**: All environment-specific configuration (e.g., database hosts, secrets) must be managed through environment variables. The `validate-env.js` script ensures required variables are present.
- **No Production Secrets in Dev/Test**: Production secrets (`JWT_SECRET`, `DB_PASSWORD`, etc.) must never be used in development or testing environments. They must not be checked into the source code repository.
- **Safer Defaults**: The default configuration is for local development (`ORCHESTRATION_MODE=LOCAL_RUNNER`). Production-specific settings (like AWS ARNs) are only loaded if explicitly configured via environment variables.

## 3. Data
- Production data must not be copied to or used in development or testing environments without being anonymized.
- The `restore-db.sh` script should only be used with production backups on production-replica environments for disaster recovery testing.

## 4. Deployment
- Code is promoted from development to testing and then to production. Direct code changes to the production environment are forbidden. All changes must go through the established CI/CD pipeline.