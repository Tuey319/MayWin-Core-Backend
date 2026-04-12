# MayWin Scheduling System: Overtime Implementation Analysis

## Executive Summary

The system currently enforces **one shift per (worker, date)** throughout the entire pipeline. Overtime is tracked as a **count** (assignments above regular shifts), not as an explicit "shift type" that can be returned separately. To support explicit double-shift OT, you must:

1. **Database**: Remove uniqueness constraint on `(schedule_run_id, worker_id, date)` and add shift ordering/type indication
2. **Solver Logic**: Add CP-SAT variables for a second shift slot and constraints to control when it's used
3. **Normalizer**: Define and communicate explicit OT shift flags
4. **API**: Return assignments with OT indicators instead of computing OT post-hoc

---

## 1. SOLVER LOGIC (`src/aws/solver_lambda/solver_cli.py`)

### Current Structure (One Shift Per Day)

**Key Constraint (Line ~280):**
```python
# ≤ 1 shift/day per nurse (STRICT MODEL)
for n in nurses:
    for d in days:
        model.Add(sum(x[(n, d, s)] for s in shifts) <= 1)
```

This is the **hard blocker** for double shifts. The solver enforces that `sum(x[(n, d, s)] for s in shifts)` ≤ 1, meaning a nurse can only be assigned to one shift per day.

### Overtime Constraint

**Overtime Model (Lines ~299-302):**
```python
per_nurse_regular[n]     # e.g., 18 shifts/month (regular)
per_nurse_max_ot[n]      # e.g., 10 shifts/month (OT allowed)

# Track overtime as total - regular
model.Add(total - over[n] <= per_nurse_regular[n])
model.Add(over[n] <= per_nurse_max_ot[n])
```

- `total` = sum of all assignments for a nurse
- `over[n]` = integer variable capping OT slack
- No distinction between which shifts are "overtime" vs "regular"
- OT is only counted by the solver (not marked per-assignment)

### Variables & Constraints Summary

| Element | Type | Description |
|---------|------|-------------|
| `x[(n, d, s)]` | BoolVar | Assignment decision: nurse n on day d for shift s |
| `under[(d, s)]` | IntVar | Understaff slack per (date, shift) |
| `over[n]` | IntVar | Overtime count per nurse (0–`max_ot_per_nurse`) |
| **Constraint** | | **Max 1 shift/day** |
| **Constraint** | | **No Night→Morning on consecutive days** (HARD) |
| **Constraint** | | **No Evening→Night on consecutive days** (HARD) |
| **Constraint** | | **≤ 2 nights/week** (HARD) |
| **Constraint** | | **≥ 2 days off/week** (HARD) |

### Post-Fill Logic: Where Double Shifts Actually Happen

**Function:** `backfill_missing_with_overtime()` (Lines ~158–239)

The post-fill **escalation ladder** allows second shifts when needed:
- **Level 0**: ≤ 1 shift/day, available, no weekly night overflow
- **Level 1**: **Allow ≤ 2 shifts/day** (`day_load < 2`), still check availability
- **Level 2**: **Allow ≤ 2 shifts/day + weekly night overflow** (>2 nights/week)
- **Level 3**: Ignore availability completely (emergency only)

**Key Code (Lines ~200–205):**
```python
day_load = load_by_day.get((n, d), 0)
if day_load >= 2:
    continue  # Already 2 shifts today, skip
if day_load >= 1 and not lvl["allow_same_day_second"]:
    continue  # Only 1 shift allowed today at this level
```

**Double-Shift Tracking:**
```python
extra_same_day[(n, d)] = count  # How many 2nd+ shifts added to nurse on day d
```

This is tracked but **not returned as explicit shift data**—only used for satisfaction scoring.

### Where Double-Shift Logic Would Go

To support explicit double shifts in the **strict model**:
1. Create a new variable set: `x2[(n, d, s)]` for "second shift" per nurse/date/shift
2. Add constraint: `x[(n, d, s)] + x2[(n, d, s)] <= 1` OR `{0, 1, 2}` depending on design
3. Add constraint: allow `x[(n, d, s)] + x2[(n, d, s)] <= 2` per day per nurse
4. Add constraint: only allow second shift if first is already assigned or if `day_load >= 1`
5. Penalize in objective: `weights.same_day_second_shift_penalty * x2[(n, d, s)]`
6. Return both `x` and `x2` assignments in `Assignment` output

---

## 2. DATA MODEL (`src/database/entities/scheduling/schedule-assignment.entity.ts`)

### Current Entity Structure

```typescript
@Entity({ schema: 'maywin_db', name: 'schedule_assignments' })
@Unique('sa_run_uniq', ['schedule_run_id', 'worker_id', 'date'])
export class ScheduleAssignment {
  id: string;
  schedule_id: string;
  schedule_run_id: string;
  worker_id: string;
  date: string;                    // ← single column (no shift ordering)
  shift_code: string;
  source: string;                  // 'SOLVER' or 'MANUAL'
  emergency_override: boolean;
  attributes: Record<string, any>; // Generic metadata
  created_at: Date;
  updated_at: Date;
}
```

### Critical Issue: Uniqueness Constraint

**Line 4:** `@Unique('sa_run_uniq', ['schedule_run_id', 'worker_id', 'date'])`

This enforces **at most one assignment per (run, worker, date)**. To support double shifts:
- **Option A** (Recommended): Remove this constraint and add a new unique index on `(schedule_run_id, worker_id, date, shift_order)` where `shift_order` is 1, 2, etc.
- **Option B** (Workaround): Use `attributes.shift_number` or `attributes.shift_order` to indicate which shift of the day this is, but this is fragile.

### Missing Fields

Currently, there's no way to distinguish:
- Which assignments are "regular" vs "overtime"
- The order of shifts when there are 2+ on the same day
- Why a particular assignment was chosen (solver decision point)

**Recommended Additions:**

```typescript
@Column({ type: 'int', default: 1 })
shift_order: number;  // 1 = first shift, 2 = second shift, etc.

@Column({ type: 'boolean', default: false })
is_overtime: boolean;  // True if counted as OT in nurse monthly total

@Column({ type: 'text', nullable: true })
assignment_type: string;  // 'REGULAR', 'OVERTIME', 'EMERGENCY', 'BACKUP'
```

And update the unique constraint:
```typescript
@Unique('sa_run_uniq', ['schedule_run_id', 'worker_id', 'date', 'shift_order'])
```

---

## 3. API RESPONSE (`src/core/jobs/jobs.service.ts` & `src/core/scheduling/`)

### Current Assignment Response Format

**Type** (`jobs.service.ts:19`):
```typescript
type PreviewAssignment = { 
  workerId: string; 
  date: string; 
  shiftCode: string; 
};
```

**Built from DB** (`jobs.service.ts:219`):
```typescript
const assignments = rows.map((r) => ({
  workerId: String(r.worker_id),
  date: String(r.date),
  shiftCode: String(r.shift_code),
  source: 'SOLVER',
  attributes: r.attributes ?? {},
}));
```

### Overtime Computation

**Current Approach** (`jobs.service.ts:239-244`):
```typescript
// Fallback when DB assignments exist
const overtime = Math.max(0, c.assigned - regular);
return {
  workerId,
  assignedShifts: c.assigned,
  overtime,  // ← Post-hoc computation, not from solver
  nights: c.nights,
};
```

**Problem**: OT is computed, not explicit. If you send 20 assignments to DB but only 18 are applied, the OT count drops incorrectly.

### How Solver OT is Currently Returned

**From Solver** (`solver_cli.py:SolveResponse`):
```python
class NurseStats(BaseModel):
    nurse: str
    assigned_shifts: int
    overtime: int              # ← Count of OT shifts above regular
    nights: int
    satisfaction: int
```

**Extracted by API** (`jobs.service.ts:295–298`):
```typescript
const nurseStats = rawStats.map((s) => ({
  workerId: s?.workerId ?? s?.worker_id,
  assignedShifts: s?.assigned_shifts,
  overtime: s?.overtime,     // ← From solver, not computed
  nights: s?.nights,
}));
```

### Changes Needed for Explicit OT

1. **Assignments Array**: Add shift metadata
   ```typescript
   type Assignment = {
     workerId: string;
     date: string;
     shiftCode: string;
     shiftOrder: number;        // 1, 2, ...
     isOvertimeShift: boolean;  // True if this shift is OT
     source: 'SOLVER' | 'MANUAL';
     attributes?: Record<string, any>;
   };
   ```

2. **NurseStats**: Keep OT count, but now it reflects actual assignments
   ```typescript
   nurseStats = {
     workerId: string;
     assignedShifts: number;    // Total (regular + OT)
     overtimeShifts: number;    // Count where isOvertimeShift=true
     regularShifts: number;     // Derived: assigned - overtime
     nights: number;
   };
   ```

3. **Return Path**: `preview()` should extract `isOvertimeShift` from solver output
   - Solver's `Assignment` model needs `is_overtime` or `assignment_type` field
   - Adapter must pass through to DB
   - API must return it to client

---

## 4. NORMALIZER (`src/core/normalizer/normalizer.service.ts`)

### What It Sends to Solver

**Build Method** (`normalizer.service.ts:67–191`):
```typescript
const payload: NormalizedInputV1 = {
  version: 'v1',
  job: { jobId, organizationId, unitId, status },
  horizon: { startDate, endDate, days: [...] },
  shifts: [              // ← Shift templates
    { code, name, startTime, endTime, attributes }
  ],
  nurses: [              // ← Worker profiles with *v3 fields*
    {
      code,
      fullName,
      employmentType,
      weeklyHours,
      tags: [skills],     // ← 'Senior', 'Bilingual', etc.
      isBackup,           // ← NEW: backup worker flag
      maxOvertimeShifts,  // ← NEW: explicit OT cap
      regularShiftsPerPeriod,  // ← NEW: regular shift target
      minShiftsPerPeriod, // ← NEW: minimum shifts
    }
  ],
  coverageRules: [
    { shiftCode, dayType, minWorkers, maxWorkers, requiredTag }
  ],
  constraints: {         // ← From ConstraintProfile
    forbidEveningToNight,
    forbidNightToMorning,
    maxShiftsPerDay,
    maxNightsPerWeek,
    // ... 20+ constraint flags
  },
  availability: [...],   // per nurse/day/shift
  preferences: {         // Penalties: nurse → day → shift → penalty
    "N001": {
      "2026-01-15": { "NIGHT": 5 }
    }
  }
}
```

### Key Fields for OT Support

**Worker-Level Fields** (Lines 138–149):
```typescript
isBackup: w.is_backup_worker ?? false,
maxOvertimeShifts: w.max_overtime_shifts ?? null,      // Cap
regularShiftsPerPeriod: w.regular_shifts_per_period ?? null, // Target
minShiftsPerPeriod: w.min_shifts_per_period ?? null,
```

**Constraint Flags** (Lines 538–551):
```typescript
guaranteeFullCoverage: cp?.guarantee_full_coverage ?? true,
allowEmergencyOverrides: cp?.allow_emergency_overrides ?? true,
allowSecondShiftSameDayInEmergency: cp?.allow_second_shift_same_day_in_emergency ?? true,
forbidNightToMorning: cp?.forbid_night_to_morning ?? true,
forbidEveningToNight: cp?.forbid_evening_to_night ?? true,
```

### Conversion to Python Request

**Adapter** (`solver.adapter.ts:275–407`):
```typescript
private toSolveRequest(normalized: any, fallbackTimeLimitSec: number) {
  // Extract regular/OT per nurse
  for (const n of normalized?.nurses ?? []) {
    if (n.regularShiftsPerPeriod != null)
      regularShiftsPerNurse[code] = Number(n.regularShiftsPerPeriod);
    if (n.maxOvertimeShifts != null)
      maxOvertimePerNurse[code] = Number(n.maxOvertimeShifts);
  }
  
  // Pass to Python as top-level request fields
  const req: Record<string, any> = {
    nurses, shifts, days, demand, availability,
    regular_shifts_per_nurse: regularShiftsPerNurse,
    max_overtime_per_nurse: maxOvertimePerNurse,
    min_total_shifts_per_nurse: minTotalShiftsPerNurse,
    // ... constraint flags as top-level fields
    forbid_evening_to_night, forbid_night_to_morning, ...
  };
}
```

### What's Missing for Explicit OT

The normalizer currently:
- ✅ Sends `regular_shifts_per_nurse` and `max_overtime_per_nurse`
- ✅ Sends constraint flags
- ❌ **Does NOT** define a shift-priority order (e.g., "NIGHT shifts count as OT first")
- ❌ **Does NOT** specify per-shift OT costs or preferences
- ❌ **Does NOT** indicate "which shifts should be marked as OT"

**To Support Explicit OT in Normalizer:**

1. Extend `Shift` template with OT indicator:
   ```typescript
   shifts: [
     { code, name, isOvertimeOnly?: boolean, overtimePriority?: number }
   ]
   ```

2. Or add a new constraint payload field:
   ```typescript
   constraints: {
     overtimeShiftCodes?: ['NIGHT_OT', 'EVENING_OT'],  // Explicit OT shift types
     overtimePriority?: { 'NIGHT': 1, 'EVENING': 2 },  // Which to assign first
   }
   ```

3. Pass to solver for explicit handling instead of post-hoc detection

---

## Summary Table: Current vs. Required for Double-Shift OT

| Aspect | Current | Required Change |
|--------|---------|-----------------|
| **Solver Model** | x[(n,d,s)] ≤ 1/day | Add x2[(n,d,s)] for 2nd shift + multi-variable support |
| **DB Constraint** | Unique(run, worker, date) | Change to Unique(run, worker, date, shift_order) |
| **Assignment Fields** | workerId, date, shiftCode | Add: shiftOrder (1,2), isOvertimeShift (bool) |
| **OT Tracking** | Computed post-hoc (assigned - regular) | Explicit per-assignment flag + solver decision |
| **API Return** | Single assignment per (worker, date) | Multiple assignments per (worker, date) with OT markers |
| **Normalizer** | Sends regular/max_ot caps | Also: shift OT priority, explicit OT shift codes |
| **Post-Fill Logic** | Escalates to 2 shifts in emergency | Keep, but return both shifts as explicit assignments |

---

## Implementation Roadmap

### Phase 1: Database Changes
1. Modify `ScheduleAssignment` entity: remove old unique constraint, add `shift_order` and `is_overtime`
2. Create migration to handle existing data
3. Update DB schema documentation

### Phase 2: Solver Changes
1. Add second shift variables `x2[(n, d, s)]` to CP-SAT model
2. Add constraint: `x[(n, d, s)] + x2[(n, d, s)] <= 2` (or 1 depending on policy)
3. Modify post-fill to return both assignments separately instead of just counting
4. Update `Assignment` class to include shift order/type
5. Update `NurseStats` to show breakdown (regular vs. OT)

### Phase 3: Adapter & Normalizer Changes
1. Extend `SolveRequest` to accept shift-level OT flags (if needed)
2. Modify normalizer to document shift OT priority
3. Update adapter to pass through shift metadata

### Phase 4: API & Persistence
1. Update jobs.service to extract `is_overtime` and `shift_order` from solver assignments
2. Modify DB write logic to save both shifts separately with correct `shift_order`
3. Update preview endpoint to group/return multiple assignments per (worker, date)
4. Update scheduling API endpoints to return grouped assignments

### Phase 5: Testing & Validation
- Test double-shift assignment persistence
- Verify OT counts match solver output
- Validate API responses correctly report shift orders
- Check that Night→Morning constraint still enforced even with 2 shifts

---

## Technical Notes

### Constraint Feasibility
- The post-fill logic already respects Night→Morning ban even when assigning 2nd shifts
- Weekly night cap can be overridden at escalation Level 2 (designed for emergency scenarios)
- Evening→Night ban is enforced but can be relaxed per constraint profile

### Performance Considerations
- Adding x2 variables doubles the CP-SAT problem size (~3x total constraints)
- Solver time will increase, but 15sec limit should still be achievable with tuning
- Post-fill still works as fallback if STRICT/RELAXED models don't find complete coverage

### Backward Compatibility
- Existing single-shift assignments can be stored with `shift_order=1, is_overtime=false`
- Old DB queries expecting one assignment per (worker, date) must be updated
- API clients must handle arrays of assignments per (worker, date)
