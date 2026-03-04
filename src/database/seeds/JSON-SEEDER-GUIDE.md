# 60-Nurse January 2026 Seeder

## Overview

This seeder creates a realistic test dataset with **60 nurses** and **31 days** (January 2026) using data from your JSON file `test_60nurses_jan2026_business_only_availability.json`.

## Quick Start

```bash
# Make sure JSON file is in project root
npx ts-node src/database/seeds/seed-from-json.ts

# Or use the quick start script
.\src\database\seeds\quickstart-json.ps1
```

## What Gets Created

| Entity | Count | Details |
|--------|-------|---------|
| **Organization** | 1 | DEMO_HOSPITAL |
| **Site** | 1 | MAIN_CAMPUS |
| **Unit** | 1 | ICU_01 (Intensive Care Unit 1) |
| **Admin User** | 1 | admin@demo.com / password123 |
| **Workers** | 60 | N001-N060 (all nurses) |
| **Memberships** | 60 | All nurses assigned to ICU_01 |
| **Shift Templates** | 4 | Morning, Evening, Night, OFF |
| **Coverage Rules** | 6 | Based on demand patterns (WEEKDAY/WEEKEND × 3 shifts) |
| **Constraint Profile** | 1 | Standard ICU constraints |
| **Schedule** | 1 | Jan 1-31, 2026 (31 days) |
| **Availability** | ~5,580 | Real availability from JSON (only 1s stored) |

## Data Characteristics

### Schedule Period
- **Start:** 2026-01-01
- **End:** 2026-01-31
- **Days:** 31 days
- **Weeks:** ~4.4 weeks

### Shifts
- **Morning:** 07:00-15:00
- **Evening:** 15:00-23:00
- **Night:** 23:00-07:00
- **OFF:** Rest day

### Coverage Requirements

The seeder analyzes the demand data and creates coverage rules automatically:

**Weekday Example:**
- Morning: min=14, max=22 (based on demand 14-20 + buffer)
- Evening: min=11, max=18 (based on demand 11-16 + buffer)
- Night: min=7, max=13 (based on demand 7-11 + buffer)

**Weekend Example:**
- Morning: min=15, max=22 (slightly different weekend pattern)
- Evening: min=11, max=18
- Night: min=8, max=13

> **Note:** Coverage rules are calculated from JSON demand data. `max_workers` includes a +2 buffer for flexibility.

### Availability Data

The JSON contains availability for each nurse × each day × each shift:
- **1** = Available for that shift on that day
- **0** = Not available

**Storage Strategy:**
- Only availability records (value=1) are stored in the database
- Unavailable slots (value=0) are inferred by absence
- This reduces database records significantly (~5,580 records instead of ~16,740)

**Coverage:**
- Each nurse has varying availability patterns
- Some nurses have days off or specific shift restrictions
- Data represents realistic scheduling constraints

## Testing the Solver

### 1. Login

```bash
POST http://localhost:3000/api/v1/core/auth/login
Content-Type: application/json

{
  "email": "admin@demo.com",
  "password": "password123"
}
```

### 2. Trigger Solver

```bash
POST http://localhost:3000/api/v1/core/orchestrator/run
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scheduleId": "1",
  "dto": {
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-01-31T23:59:59.999Z"
  }
}
```

### Expected Behavior

**Job Progression:**
```
REQUESTED → VALIDATED → NORMALIZING → SOLVING_A_STRICT 
  → SOLVING_A_RELAXED (if needed) → SOLVING_B_MILP (if needed)
  → EVALUATING → PERSISTING → COMPLETED
```

**Timing:**
- **Small dataset (8 nurses):** ~5-10 seconds
- **Large dataset (60 nurses):** ~30-90 seconds
- Depends on: complexity, availability constraints, coverage requirements

**Fallback Strategy:**
1. **A_STRICT** (30s): Try strict constraints first
2. **A_RELAXED** (20s): Relax some constraints if infeasible
3. **B_MILP** (25s): Final fallback with MILP approach

## JSON Data Structure

```json
{
  "nurses": ["N001", "N002", ..., "N060"],
  "days": ["2026-01-01", "2026-01-02", ..., "2026-01-31"],
  "shifts": ["Morning", "Evening", "Night"],
  "demand": {
    "2026-01-01": {
      "Morning": 15,
      "Evening": 11,
      "Night": 8
    },
    ...
  },
  "availability": {
    "N001": {
      "2026-01-01": {
        "Morning": 1,
        "Evening": 1,
        "Night": 1
      },
      ...
    },
    ...
  }
}
```

## Comparison: 8 vs 60 Nurses

| Feature | 8-Nurse Seed | 60-Nurse Seed |
|---------|--------------|---------------|
| **File** | `example-schedule-seed.ts` | `seed-from-json.ts` |
| **Nurses** | 8 (N001-N008) | 60 (N001-N060) |
| **Period** | 7 days (Feb 17-23) | 31 days (Jan 1-31) |
| **Availability** | All available | Real patterns from JSON |
| **Coverage** | Static rules | Demand-based from JSON |
| **Solver Time** | ~5-10 seconds | ~30-90 seconds |
| **Use Case** | Quick smoke tests | Realistic testing |
| **Complexity** | Low | High |

## Troubleshooting

### "SOLVER_INFEASIBLE" Error

**Common Causes:**
1. Not enough nurses available to meet coverage requirements
2. Coverage rules too restrictive (min_workers too high)
3. Availability constraints too limiting

**Solutions:**
- Check that coverage `min_workers` ≤ available nurses
- Review availability data for sufficient coverage
- Consider relaxing constraints in constraint profile

### Solver Takes Too Long

**Expected:**
- 60 nurses × 31 days × 3 shifts = 5,580 decision variables
- This is a moderately complex optimization problem

**Solutions:**
- Increase `timeLimitSeconds` in solver config (try 60-120s)
- The fallback strategy will try relaxed approaches
- Consider shorter time periods for initial testing

### "No Availability Records" Warning

**Check:**
1. JSON file in project root: `test_60nurses_jan2026_business_only_availability.json`
2. JSON structure matches expected format
3. Availability values are 0 or 1

## Next Steps

After seeding:
1. ✅ **Test with full month:** Use all 31 days
2. ✅ **Test with partial period:** Try 1 week (Jan 1-7)
3. ✅ **Adjust coverage:** Modify coverage rules to see solver behavior
4. ✅ **Add preferences:** Update worker preferences for better satisfaction
5. ✅ **Monitor KPIs:** Check solver output for metrics

## Files

- **Seeder:** `src/database/seeds/seed-from-json.ts`
- **Quick Start:** `src/database/seeds/quickstart-json.ps1`
- **JSON Data:** `test_60nurses_jan2026_business_only_availability.json` (project root)
- **API Tests:** `src/database/seeds/api-test.http`
- **Documentation:** `src/database/seeds/README.md`

## Support

For issues or questions:
1. Check the main [README](../../../README.md)
2. Review [API_REFERENCE](../../../API_REFERENCE.md)
3. Check solver logs in application output
4. Verify database records with SQL queries

---

**Happy Scheduling! 🎉**
