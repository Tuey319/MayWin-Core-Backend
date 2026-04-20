# Nurse Scheduling Solver — CLI Guide

The solver runs as either a FastAPI HTTP server or a command-line tool. Both modes accept the same JSON payload.

---

## Running

### HTTP server (production)
```bash
uvicorn solver_cli:app --reload --port 8001
# POST http://localhost:8001/solve
```

### CLI (testing / debugging)
```bash
# from stdin
echo '{"nurses":["A","B"],...}' | python solver_cli.py --cli

# from file
python solver_cli.py --cli --input request.json

# file → file
python solver_cli.py --cli --input request.json --output result.json
```

---

## Request Schema

```json
{
  "nurses":  ["N1", "N2", "N3"],
  "days":    ["2026-04-01", "2026-04-02"],
  "shifts":  ["morning", "evening", "night"],
  "demand":  {
    "2026-04-01": { "morning": 2, "evening": 2, "night": 1 },
    "2026-04-02": { "morning": 2, "evening": 2, "night": 1 }
  },

  "time_limit_sec": 20,
  "num_search_workers": 8,
  "random_seed": 42,
  "enable_cp_sat_log": false,

  "rules": { ... },
  "weights": { ... }
}
```

### Critical: shift names vs shift codes

The solver uses **exact string matching** to identify morning / evening / night shifts.
`find_shift_name(shifts, "night")` does a **case-insensitive equality** check — not a
substring search.

| shifts array value | morning/evening/night detected? |
|---|---|
| `"morning"`, `"evening"`, `"night"` | **Yes** — all label constraints active |
| `"M"`, `"A"`, `"N"` | **No** — label constraints silently skipped |

**When labels are not detected, the following constraints are silently disabled:**
- Shift-type limits (`max_shift_per_type`)
- Night-to-morning forbid
- Weekly night cap
- Consecutive night limit
- Evening→Night penalty
- Shift-type balance objective
- Evening-after-morning overtime counting

The production normalizer currently sends **codes** (`M`, `A`, `N`), so these constraints
are inactive in production. This is a known mismatch.

---

## Rules Reference

```json
{
  "guarantee_full_coverage": true,
  "allow_emergency_overrides": true,

  "max_shifts_per_day": 1,
  "min_days_off_per_week": 2,
  "max_nights_per_week": 2,

  "enable_min_total_days_off": true,
  "min_total_days_off": 11,

  "forbid_night_to_morning": true,
  "forbid_morning_to_night_same_day": false,

  "allow_second_shift_same_day_in_emergency": true,
  "allow_night_cap_override_in_emergency": true,
  "allow_rest_rule_override_in_emergency": true,

  "enable_shift_type_limit": true,
  "max_shift_per_type": { "morning": 9, "evening": 9, "night": 9 },

  "enable_consecutive_night_limit": true,
  "max_consecutive_night_shifts": 3,

  "goal_minimize_staff_cost": true,
  "goal_maximize_preference_satisfaction": false,
  "goal_balance_workload": false
}
```

---

## Solve phases

**Phase 1 (normal):** Coverage is a hard constraint — `assigned == demand[d][s]`.
If infeasible (too few nurses), falls through to Phase 2.

**Phase 2 (emergency):** Coverage becomes soft — `assigned + under >= demand`. The solver
minimises `under` (missing slots) with heavy penalty. `max_shifts_per_day` rises to 2 if
`allow_second_shift_same_day_in_emergency = true`.

If Phase 2 still returns INFEASIBLE, the response status is `"INFEASIBLE"`.

---

## Capacity math (important)

With `enable_min_total_days_off = true` and `min_total_days_off = 11` over a 30-day month:

- Max work days per nurse = 30 − 11 = **19**
- Phase 1: 19 × 1 shift/day = 19 shifts max
- Phase 2: 19 × 2 shifts/day = 38 shifts max (with emergency double-shift)
- OT cap (default 12) limits: regular = 30, total max = 42 — but work-day cap = 38 wins

**6 nurses × 38 = 228** — demand for 3M+3A+2N coverage = **240/month** → always short by 12+.
**7 nurses × 38 = 266** ≥ 240 → feasible.

---

## Example 1 — 3-nurse, 3-day (minimal feasible)

Demand = 3 shifts × 3 days = 9 slots. 3 nurses × 3 days × 1 shift = 9 supply. Should be OPTIMAL.

```json
{
  "nurses": ["Alice", "Bob", "Carol"],
  "days": ["2026-04-01", "2026-04-02", "2026-04-03"],
  "shifts": ["morning", "evening", "night"],
  "demand": {
    "2026-04-01": {"morning": 1, "evening": 1, "night": 1},
    "2026-04-02": {"morning": 1, "evening": 1, "night": 1},
    "2026-04-03": {"morning": 1, "evening": 1, "night": 1}
  },
  "time_limit_sec": 10,
  "rules": {
    "guarantee_full_coverage": true,
    "allow_emergency_overrides": true,
    "min_days_off_per_week": 0,
    "enable_min_total_days_off": false,
    "enable_shift_type_limit": false,
    "max_shifts_per_day": 1
  }
}
```

**Observed result:** `OPTIMAL`, `coverage_missing: 0`. Each nurse gets exactly 1M+1E+1N.

---

## Example 2 — 6-nurse, 30-day (understaffed — production scenario)

```json
{
  "nurses": ["N1","N2","N3","N4","N5","N6"],
  "days": ["2026-04-01",...,"2026-04-30"],
  "shifts": ["M", "A", "N"],
  "demand": { "2026-04-01": {"M":3,"A":3,"N":2}, ... },
  "time_limit_sec": 15,
  "rules": {
    "guarantee_full_coverage": true,
    "allow_emergency_overrides": true,
    "enable_min_total_days_off": true,
    "min_total_days_off": 11,
    "min_days_off_per_week": 2
  }
}
```

**Observed result:** `EMERGENCY_FEASIBLE`, `coverage_missing: 12`, each nurse at 38 shifts / 8 OT.
Shifts use codes so label constraints are inactive.

---

## Example 3 — 7-nurse, 30-day (production + 1 nurse)

Same as Example 2 but with 7 nurses.

**Observed result:** `EMERGENCY_FEASIBLE`, `coverage_missing: 7`, nurses at 33–35 shifts.
Still short — increasing to 8–9 nurses would achieve full coverage.

---

## Resolving INFEASIBLE / understaffing

| Problem | Likely cause | Fix |
|---|---|---|
| INFEASIBLE with enough nurses | `min_total_days_off` too high | Lower `min_total_days_off` or disable it |
| `coverage_missing > 0` always | Not enough nurses for demand | Add nurses or reduce demand (`minWorkers`) |
| Label constraints not working | Shift codes used instead of names | Rename shifts to `"morning"/"evening"/"night"` |
| `AttributeError: _meta` | Old bug in solver (fixed) | Pull latest `solver_cli.py` |

---

## Response Schema

```json
{
  "status": "OPTIMAL | FEASIBLE | EMERGENCY_OPTIMAL | EMERGENCY_FEASIBLE | INFEASIBLE | ERROR",
  "objective_value": 12345,
  "assignments": [
    { "day": "2026-04-01", "shift": "morning", "nurse": "N1", "emergency_override": false }
  ],
  "understaffed": [
    { "day": "2026-04-15", "shift": "N", "missing": 1 }
  ],
  "nurse_stats": [
    {
      "nurse": "N1",
      "assigned_shifts": 34,
      "overtime": 8,
      "morning_shifts": 0,
      "evening_shifts": 0,
      "night_shifts": 0,
      "satisfaction": 85
    }
  ],
  "details": {
    "average_satisfaction": 85.0,
    "coverage_missing": 12,
    "additional_nurses_required": 1,
    "emergency_override_count": 0,
    "wall_time_sec": 15.1,
    "conflicts": 1204,
    "branches": 9874
  }
}
```

Note: `morning_shifts / evening_shifts / night_shifts` are always 0 if shift codes (M/A/N) are used
instead of full names, because `find_shift_name` can't detect them.
