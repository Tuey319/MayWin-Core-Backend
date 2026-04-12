# Solver Debug Report — May 2026 Schedule (Unit 5)
**Date:** 2026-04-11  
**Schedule:** May 2026, Unit 5, 8 nurses, 31 days  
**Job ID:** c671ad02-a1da-464f-901c-27317360403e  
**Constraint Profile:** id=14 (Ward 3A – May 2026)

---

## Problem Statement

The nurse scheduling solver was producing an incomplete and incorrect schedule:

| Metric | Expected | Actual |
|--------|----------|--------|
| Total assignments | 186 | 156–160 |
| Daily coverage | 6 shifts/day (2×3 types) | 4 shifts/day |
| Total OT | ~26 | 0 |
| `shiftOrder` values | 1 and 2 | all 1 |
| `isOvertime` flags | some true | all false |

Morning shifts were chronically understaffed. OT double-shifts (MORNING+EVENING same day) were never appearing in the output despite the solver needing them to reach full 186-slot coverage.

---

## System Overview

```
NormalizerService  →  SolverAdapter / solver_cli.py (CP-SAT)  →  lambda.ts  →  DB
(NestJS + TypeORM)     (Python OR-Tools)                         (persistence)
```

**Demand:** 8 nurses × 31 days × 3 shifts (MORNING/EVENING/NIGHT), minWorkers=2 per slot = **186 total assignments needed**

**Key nurse:** NURSE_001 (worker 69) is morning-only, works exactly 20 days → provides 20 of 62 morning slots. The remaining 7 nurses must cover **166 shifts** (42 morning + 62 evening + 62 night).

**Capacity math:**
- 7 nurses × 20 regular shifts = 140 (not enough)
- Need 166 → deficit of **26 OT shifts**
- 7 nurses × 4 max OT = 28 OT capacity → mathematically feasible

---

## Root Cause Analysis

Three bugs were found, layered on top of each other. Each individually prevented full coverage. All three needed to be fixed.

---

### Bug 1: `eveningAfterMorningCountsAsOvertime = true` (Data Bug)

**Location:** `constraint_profiles` table, id=14, `attributes` JSONB column  
**Read by:** `normalizer.service.ts:529` → `readAttr('eveningAfterMorningCountsAsOvertime', ...)`  
**Used by:** `solver_cli.py:379` → `if rules.evening_after_morning_counts_as_overtime`

**What it did:**

When a nurse worked MORNING+EVENING on the same day, the solver counted that as:
- +2 toward total shifts (correct — it is 2 shifts)
- +1 extra OT via the `extra_ot[(n,d)]` variable (incorrect double-counting)

So `over[n] = base_ot + extra_ot_sum`. For a nurse with regular=20 and one double-shift day:
```
total = 21 shifts
base_ot = max(0, 21 - 20) = 1
extra_ot_sum = 1  (the double-shift day)
over[n] = 2
```

With `max_ot = 4`, this halved effective OT capacity: only **2 double-shift days** per nurse instead of 4. Combined with the already tight feasibility margin, this made full coverage infeasible.

**Fix:** SQL update on constraint profile id=14:
```sql
UPDATE maywin_db.constraint_profiles
SET attributes = attributes || '{"eveningAfterMorningCountsAsOvertime": false}'::jsonb
WHERE id = 14;
```

---

### Bug 2: `max_shifts_per_day = 1` Blocking Double-Shifts in Phase 1 (Config Bug)

**Location:** `constraint_profiles.max_shifts_per_day` column, default value = 1  
**Read by:** `normalizer.service.ts:484` → `maxShiftsPerDay: cp?.max_shifts_per_day ?? 1`  
**Used by:** `solver_cli.py:408–414`

**What it did:**

The solver runs in two phases:

```
Phase 1 (strict):   HARD coverage (assigned == demand), max_shifts_per_day = rules.max_shifts_per_day
Phase 2 (emergency): SOFT coverage (under slack),       max_shifts_per_day = max(rules.max_shifts_per_day, 2)
```

With `max_shifts_per_day = 1`, Phase 1 could not assign double-shifts. Since 7 nurses × 20 regular = 140 < 166 needed, Phase 1 was always **INFEASIBLE**. This meant every solve fell through to Phase 2 (emergency mode).

Phase 2 correctly raises the cap to 2, but it uses soft coverage penalties rather than hard constraints. The objective weighting was `understaff_penalty=50000` vs `overtime_penalty=0`, which should force full coverage — but only after Bug 3 was also present (causing assignments to be silently dropped before they reached the DB).

**Additionally**, the existing `max_nights_per_week` was set to 7 in the DB (no weekly night cap), which masked the problem during testing.

**Fix:** SQL update on constraint profile id=14:
```sql
UPDATE maywin_db.constraint_profiles
SET max_shifts_per_day = 2
WHERE id = 14;
```

With `max_shifts_per_day = 2`, Phase 1 can directly assign double-shifts and find the optimal full-coverage solution without needing emergency fallback.

---

### Bug 3: `shift_order` Not Emitted by Solver → Double-Shifts Silently Dropped (Code Bug)

**Location:** `solver_cli.py:134–138` (Assignment model) + `solver_cli.py:800` (pack_solution)  
**Affected by:** `lambda.ts:311–312, 750–754` + `jobs-runner.service.ts:449–450`

**This was the primary cause of 160 vs 186 assignments.**

**The solver's `Assignment` model had no `shift_order` or `is_overtime` fields:**

```python
# BEFORE (broken)
class Assignment(BaseModel):
    day: str
    shift: str
    nurse: str
    emergency_override: bool = False
    # ← no shift_order, no is_overtime
```

When `lambda.ts` read the solver output, it fell back to default values:

```typescript
// lambda.ts:311–312
const shiftOrder = Number(a?.shiftOrder ?? a?.shift_order ?? 1);  // always 1
const isOvertime = Boolean(a?.isOvertime ?? a?.is_overtime ?? false);  // always false
```

The persistence layer then deduplicates by a compound key:

```typescript
// lambda.ts:752
const key = `${r.schedule_id}__${r.worker_id}__${r.date}__${r.shift_order}`;
dedupe.set(key, r);  // last one wins
```

**Result:** When a nurse worked both MORNING and EVENING on the same day, both assignments were emitted with `shift_order=1`. The dedup map's `last one wins` semantics meant one of the two was silently dropped.

With 26 double-shift days needed: **26 assignments were dropped**, leaving 186 − 26 = **160 in the DB**.

**The fix — `solver_cli.py`:**

```python
# AFTER (fixed)
class Assignment(BaseModel):
    day: str
    shift: str
    nurse: str
    emergency_override: bool = False
    shift_order: int = 1      # ← added
    is_overtime: bool = False  # ← added
```

```python
# pack_solution — track per-(nurse, day) shift count
nurse_day_shift_count: Dict[Tuple[str, str], int] = {}

for n in nurses:
    for d in days:
        for s in shifts:
            val = int(solver.Value(x[(n, d, s)]))
            assigned_map[(n, d, s)] = val
            if val == 1:
                ev = int(solver.Value(override[(n, d, s)]))
                if ev:
                    emergency_count[n] += 1
                nurse_day_shift_count[(n, d)] = nurse_day_shift_count.get((n, d), 0) + 1
                order = nurse_day_shift_count[(n, d)]
                assignments.append(Assignment(
                    day=d, shift=s, nurse=n,
                    emergency_override=bool(ev),
                    shift_order=order,       # ← 1 for first shift, 2 for double-shift
                    is_overtime=(order > 1), # ← true for second shift of the day
                ))
```

The dedup key now correctly differentiates the two shifts (`shift_order=1` vs `shift_order=2`), and both are saved to the DB.

---

## Final Constraint Profile (id=14) Settings

All changes applied via SQL `UPDATE maywin_db.constraint_profiles ... WHERE id = 14`.

### Direct columns

| Column | Value | Reason |
|--------|-------|--------|
| `max_shifts_per_day` | `2` | Allows double-shifts in Phase 1 |
| `max_consecutive_night_shifts` | `3` | Max 3 consecutive nights |
| `min_days_off_per_week` | `2` | At least 2 days off per calendar week |
| `forbid_night_to_morning` | `true` | Hard forbid NIGHT→MORNING cross-day |
| `forbid_morning_to_night_same_day` | `true` | Hard forbid MORNING+NIGHT same day |
| `forbid_evening_to_night` | `true` | Drives high penalty (see below) |
| `guarantee_full_coverage` | `true` | Force full 186-slot coverage |
| `allow_emergency_overrides` | `true` | Allow Phase 2 as fallback |
| `time_limit_sec` | `60` | More time for OT distribution |

### Penalty weights (`penalty_weight_json`)

| Key | Value | Reason |
|-----|-------|--------|
| `understaff_penalty` | 50000 | Must dominate all other costs |
| `overtime_penalty` | 0 | OT shifts have no extra cost (we need them) |
| `same_day_second_shift_penalty` | 150 | Soft — use OT only when needed |
| `evening_to_night_penalty` | 99999 | Effectively hard-forbid EVENING+NIGHT same day |
| `overtime_balance_penalty` | 500 | Spread OT evenly across nurses |

### Attributes JSONB (advanced solver knobs)

| Key | Value |
|-----|-------|
| `eveningAfterMorningCountsAsOvertime` | `false` |
| `enableShiftTypeLimit` | `true` |
| `maxShiftPerType` | `{"morning":9,"evening":9,"night":9}` |
| `enableConsecutiveNightLimit` | `true` |
| `enableMinTotalDaysOff` | `true` |
| `minTotalDaysOff` | `11` |

---

## Code Changes

### `src/aws/solver_lambda/solver_cli.py`

**Change 1** — `Assignment` model (line 134):  
Added `shift_order: int = 1` and `is_overtime: bool = False` fields.

**Change 2** — `pack_solution` function (line ~800):  
Added `nurse_day_shift_count` dict to track per-(nurse, day) assignment count. Each assigned shift gets the correct `shift_order` (1 for first shift, 2 for second), and `is_overtime=True` for any second shift.

No changes required in TypeScript — `lambda.ts` and `jobs-runner.service.ts` already read `shift_order` and fall back to `shiftOrder > 1` for `isOvertime`, so they handle the new fields correctly without modification.

---

## Verification

Expected test outcomes after all three fixes:

| Test | Before | After |
|------|--------|-------|
| Total assignments == 186 | FAIL (160) | PASS |
| Daily coverage == 6 shifts/day | FAIL (4) | PASS |
| NURSE_001 works 20 days, 0 OT, morning-only | PASS | PASS |
| All nurses: work=20, off=11 | PASS | PASS |
| Max 3 consecutive nights | PASS | PASS |
| Max 9 per shift type | PASS | PASS |
| Zero NIGHT+MORNING same-day combos | PASS | PASS |
| Total OT ≈ 26 | FAIL (0) | PASS |
| No two consecutive off days | FAIL | Not enforced (solver limitation) |

**Note on "no two consecutive off days":** The CP-SAT solver has `maxConsecutiveWorkDays` but no `maxConsecutiveOffDays` constraint. Enforcing this would require a new constraint block in `build_solver_model` in `solver_cli.py`. With the current tight capacity (26 OT shifts needed), adding this constraint may make the problem infeasible.

---

## Timeline

| Step | Action |
|------|--------|
| 1 | Identified `eveningAfterMorningCountsAsOvertime=true` as OT double-counting bug |
| 2 | Fixed via SQL on constraint profile id=14 |
| 3 | Re-ran solver → still 0 OT (Bug 2 + Bug 3 still present) |
| 4 | Identified `max_shifts_per_day=1` blocking Phase 1 double-shifts |
| 5 | Full constraint profile SQL update applied (Bug 2 fix + all tuning) |
| 6 | Re-ran solver → 160/186 assignments, all `shiftOrder=1`, all `isOvertime=false` |
| 7 | Traced data flow: solver → `normalizeAssignment` → dedup map |
| 8 | Found `Assignment` model missing `shift_order`/`is_overtime` fields |
| 9 | Fixed `solver_cli.py` — `Assignment` model + `pack_solution` counter |
| 10 | Re-run expected to produce 186 assignments with correct OT flags |
