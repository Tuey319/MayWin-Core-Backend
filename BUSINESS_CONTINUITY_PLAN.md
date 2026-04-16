# ICT Readiness for Business Continuity

**Control**: ISO/IEC 27002 A.5.30

This plan details the procedures for restoring the MayWin Core Backend service in the event of a critical failure, ensuring Information and Communication Technology (ICT) readiness.

## 1. Recovery Time Objective (RTO) & Recovery Point Objective (RPO)
- **RTO**: 4 hours. The time within which the service must be restored.
- **RPO**: 24 hours. The maximum acceptable amount of data loss, aligned with the daily backup frequency.

## 2. Recovery Procedure
This procedure assumes a total loss of the primary database server.

1.  **Provision New Infrastructure**:
    - A new PostgreSQL database instance is provisioned.
    - A new application server environment (e.g., EC2 instance, container host) is provisioned.

2.  **Restore Database**:
    - Retrieve the latest successful daily backup file (e.g., `maywin_db_YYYYMMDD_HHMMSS.sql`) from secure storage.
    - Set the required environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, etc.) for the new database.
    - Execute the restore script: `./scripts/restore-db.sh <path_to_backup_file.sql>`.
    - Verify data integrity by checking key tables (e.g., `users`, `organizations`).

3.  **Deploy Application**:
    - Deploy the latest stable version of the backend application.
    - Configure all required environment variables (`JWT_SECRET`, `FRONTEND_URL`, etc.) in the new environment.
    - Start the application. The startup validation (`validate-env.js`) will confirm connectivity.

4.  **Verify Service**:
    - Perform a health check: `GET /health`.
    - Perform a test login via the API to confirm database and authentication functionality.
    - Update DNS or load balancer to point to the new application server.

## 3. Degraded Service (Solver Unavailability)
- If the core scheduling solver is unavailable, the API remains operational for all other functions (e.g., manual schedule edits, user management, messaging).
- Users can continue to view and manually edit existing schedules. New automated scheduling runs (`POST /schedules/:scheduleId/jobs`) will fail until the solver is restored.