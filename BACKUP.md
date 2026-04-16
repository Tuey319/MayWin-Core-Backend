# Backup & Recovery Procedures

**Control**: ISO/IEC 27002 A.8.13 Information Backup

## Overview
The MayWin Core Backend uses PostgreSQL. Regular backups are essential to ensure business continuity and data integrity in the event of system failure or corruption.

## Backup Strategy
- **Frequency**: Daily (recommended via cron)
- **Type**: Full SQL Dump
- **Retention**: 30 days locally, replicated to S3 (if configured)

## Performing a Backup

Run the automated script from the project root:

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

Artifacts are stored in the `./backups/` directory with the format `maywin_db_YYYYMMDD_HHMMSS.sql`.

## Restoring Data

To restore a specific backup file:

```bash
./scripts/restore-db.sh ./backups/maywin_db_20260109_120000.sql
```