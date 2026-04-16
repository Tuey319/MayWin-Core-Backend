# Business Continuity Plan (BCP)

**Control**: ISO/IEC 27001:2022 A.5.30

## 1. Purpose
This document outlines the plan to ensure the continuity of the MayWin Core Backend service in the event of a disaster or major outage. This plan focuses on the backup and recovery of the primary PostgreSQL database.

## 2. Objectives
- **Recovery Point Objective (RPO)**: 24 hours. We can tolerate the loss of up to 24 hours of data.
- **Recovery Time Objective (RTO)**: 4 hours. The service should be restored to operation within 4 hours of a declared disaster.

## 3. Backup Procedure
- **Frequency**: A full backup of the production PostgreSQL database is performed daily.
- **Method**: The backup is executed using a shell script that leverages `pg_dump`.
- **Evidence**: `scripts/backup-db.sh`
- **Storage**: Backups are stored in a secure, versioned, and encrypted AWS S3 bucket. The bucket is located in a different region from the primary infrastructure for geographic redundancy.
- **Retention**: Backups are retained for 30 days, as defined in `docs/security/DATA_RETENTION_POLICY.md`.

## 4. Recovery Procedure
- **Declaration**: A disaster is declared by the Incident Lead when the production database is determined to be unrecoverable.
- **Steps**:
  1. The DevOps Engineer retrieves the latest successful backup file from the S3 bucket.
  2. A new PostgreSQL instance is provisioned if the original is not available.
  3. The database is restored from the backup file using the `restore-db.sh` script.
  4. The application's environment variables are updated to point to the new database instance.
  5. The application is restarted, and basic functionality is tested to confirm a successful recovery.
- **Evidence**: `scripts/restore-db.sh`

## 5. Plan Testing
The recovery procedure must be tested at least semi-annually to ensure its effectiveness and to validate the RTO. The results of each test will be documented.