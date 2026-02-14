# Database Seeding for Schedule Generation

This directory contains seeding scripts to populate your database with the minimum required data to test the schedule generation/solver functionality.

## Prerequisites

- PostgreSQL database running
- Database schema `maywin_db` created (run migrations first)
- Node.js and TypeScript installed (for TypeScript seed)
- Database connection configured in `.env`

## Option 1: TypeScript Seeder (Recommended)

### Run the TypeScript Seed

```bash
# From the project root
npx ts-node src/database/seeds/example-schedule-seed.ts
```

### What it creates:

- ✅ **1 Organization** (DEMO_HOSPITAL)
- ✅ **1 Site** (MAIN_CAMPUS)
- ✅ **1 Unit** (ICU_01 - Intensive Care Unit)
- ✅ **1 Admin User** (admin@demo.com / password123)
- ✅ **8 Workers** (Nurses N001-N008)
- ✅ **8 Worker-Unit Memberships** (all nurses assigned to ICU_01)
- ✅ **4 Shift Templates** (DAY, EVENING, NIGHT, OFF)
- ✅ **6 Coverage Rules** (weekday + weekend requirements)
- ✅ **1 Constraint Profile** (scheduling rules)
- ✅ **1 Schedule** (2026-02-17 to 2026-02-23)
- ✅ **8 Availability Records** (all nurses available for the week)

### Advantages:

- Idempotent (safe to run multiple times)
- Proper password hashing with bcrypt
- Detailed console output with IDs
- Uses TypeORM entities (type-safe)

## Option 2: SQL Seeder

### Run the SQL Seed

```bash
psql -U postgres -d maywin -f src/database/seeds/example-schedule-seed.sql
```

Or connect to your database and copy-paste the SQL.

### Notes:

- **Password hash** in SQL is pre-generated for `password123`
- **IDs are hardcoded** (assumes sequential IDs 1, 2, 3...)
- If you have existing data, adjust IDs accordingly
- Uses `ON CONFLICT DO NOTHING` for idempotency

## After Seeding

### 1. Get JWT Token

```bash
POST http://localhost:3000/api/v1/core/auth/login
Content-Type: application/json

{
  "email": "admin@demo.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "organizationId": "1",
    "roles": [],
    "unitIds": []
  }
}
```

### 2. Trigger Schedule Generation

```bash
POST http://localhost:3000/api/v1/core/orchestrator/run
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "scheduleId": "1",
  "dto": {
    "startDate": "2026-02-17T00:00:00.000Z",
    "endDate": "2026-02-23T23:59:59.999Z"
  }
}
```

**Response (LOCAL_RUNNER mode):**
```json
{
  "ok": true,
  "mode": "LOCAL_RUNNER",
  "job": {
    "id": "9e5ebb62-ead9-44c4-8ecf-05c9905b432c",
    "scheduleId": "1",
    "state": "REQUESTED",
    "createdAt": "2026-02-14T10:30:00.000Z"
  }
}
```

### 3. Check Job Status

```bash
GET http://localhost:3000/api/v1/core/jobs/{jobId}
Authorization: Bearer <your-jwt-token>
```

**Job progresses through states:**
```
REQUESTED → VALIDATED → NORMALIZING → SOLVING_A_STRICT 
  → SOLVING_A_RELAXED → SOLVING_B_MILP → EVALUATING 
  → PERSISTING → COMPLETED
```

### 4. Preview Results

```bash
GET http://localhost:3000/api/v1/core/jobs/{jobId}/preview
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "summary": {
    "totalAssignments": 56,
    "workerCount": 8,
    "dateRange": {
      "from": "2026-02-17",
      "to": "2026-02-23"
    }
  },
  "assignments": [
    {
      "workerId": "1",
      "workerCode": "N001",
      "date": "2026-02-17",
      "shiftCode": "DAY"
    },
    ...
  ]
}
```

### 5. Apply Schedule (Persist Assignments)

```bash
POST http://localhost:3000/api/v1/core/jobs/{jobId}/apply
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "overwriteManualChanges": false
}
```

### 6. View Final Schedule

```bash
GET http://localhost:3000/api/v1/core/schedules/1
Authorization: Bearer <your-jwt-token>
```

## Customization

### Change Schedule Dates

In the seed file, modify:

```typescript
const startDate = '2026-02-17'; // Your start date
const endDate = '2026-02-23';   // Your end date
```

Or in SQL:

```sql
'2026-02-17',  -- start_date
'2026-02-23',  -- end_date
```

### Add More Workers

In TypeScript seed:

```typescript
const workerCodes = ['N001', 'N002', ..., 'N010']; // Add more codes
```

In SQL seed:

```sql
INSERT INTO maywin_db.workers (...)
VALUES
  (...),
  (1, 1, 'Nurse N009', 'N009', 'FULL_TIME', 40, true, ...),
  (1, 1, 'Nurse N010', 'N010', 'FULL_TIME', 40, true, ...);
```

### Adjust Coverage Requirements

Modify coverage rules to require more/fewer nurses per shift:

```typescript
{ shiftCode: 'DAY', dayType: 'WEEKDAY', minWorkers: 4, maxWorkers: 5 },
```

### Change Constraints

Adjust constraint profile values:

```typescript
max_consecutive_work_days: 6,        // Instead of 5
max_consecutive_night_shifts: 2,     // Instead of 3
min_rest_hours_between_shifts: 16,   // Instead of 12
```

## Troubleshooting

### "Organization already exists"

The seed is idempotent. If data exists, it will skip creation. This is normal.

### "Password doesn't work"

- TypeScript seed: Password is `password123` with proper bcrypt hash
- SQL seed: If you changed the hash, regenerate it:
  ```bash
  node -e "console.log(require('bcrypt').hashSync('password123', 10))"
  ```

### "No workers found during normalization"

Ensure:
1. Workers are created
2. Worker-unit memberships exist
3. Workers have `is_active = true`
4. Check unit_id matches

### "Solver returns infeasible"

Common causes:
- **Too few workers** for coverage requirements
- **Coverage rules too strict** (e.g., min_workers > available workers)
- **Availability constraints** (workers marked unavailable)

Solutions:
- Add more workers
- Reduce min_workers in coverage rules
- Ensure all workers have availability records

### "Python solver not found"

Set environment variables:

```bash
# Windows
SOLVER_PYTHON=py

# Linux/Mac
SOLVER_PYTHON=python3

# Custom path
SOLVER_CLI_PATH=src/core/solver/solver_cli.py
```

## Verification Queries

Check your seed data:

```sql
-- All entities count
SELECT 
  (SELECT COUNT(*) FROM maywin_db.organizations WHERE code = 'DEMO_HOSPITAL') as orgs,
  (SELECT COUNT(*) FROM maywin_db.units WHERE code = 'ICU_01') as units,
  (SELECT COUNT(*) FROM maywin_db.workers WHERE organization_id = 1) as workers,
  (SELECT COUNT(*) FROM maywin_db.shift_templates WHERE unit_id = 1) as shifts,
  (SELECT COUNT(*) FROM maywin_db.coverage_rules WHERE unit_id = 1) as coverage,
  (SELECT COUNT(*) FROM maywin_db.schedules WHERE unit_id = 1) as schedules;

-- Review schedule details
SELECT id, name, start_date, end_date, status 
FROM maywin_db.schedules 
WHERE unit_id = 1;

-- Check workers and memberships
SELECT w.id, w.worker_code, w.full_name, wum.unit_id, wum.role_code
FROM maywin_db.workers w
LEFT JOIN maywin_db.worker_unit_memberships wum ON w.id = wum.worker_id
WHERE w.organization_id = 1;
```

## Clean Up

To remove seeded data and start fresh:

```sql
-- WARNING: This deletes all data from these tables
DELETE FROM maywin_db.worker_availability WHERE unit_id = 1;
DELETE FROM maywin_db.schedules WHERE unit_id = 1;
DELETE FROM maywin_db.constraint_profiles WHERE unit_id = 1;
DELETE FROM maywin_db.coverage_rules WHERE unit_id = 1;
DELETE FROM maywin_db.shift_templates WHERE unit_id = 1;
DELETE FROM maywin_db.worker_unit_memberships WHERE unit_id = 1;
DELETE FROM maywin_db.workers WHERE organization_id = 1;
DELETE FROM maywin_db.users WHERE email = 'admin@demo.com';
DELETE FROM maywin_db.units WHERE code = 'ICU_01';
DELETE FROM maywin_db.sites WHERE code = 'MAIN_CAMPUS';
DELETE FROM maywin_db.organizations WHERE code = 'DEMO_HOSPITAL';
```

## Additional Resources

- [API Reference](../../API_REFERENCE.md) - Full API documentation
- [README](../../README.md) - Project setup and configuration
- [Orchestration Flow](../../docs/orchestration-flow.md) - How the solver works

---

**Questions?** Check the main README or API reference for more details on the scheduling system architecture.
