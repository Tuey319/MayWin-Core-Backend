# MayWin Nurse Scheduling Solver — How It Works

> **Source:** `maywin_core_backend_main/src/core/solver/solver_cli.py`  
> **Engine:** [Google OR-Tools CP-SAT](https://developers.google.com/optimization/reference/python/sat/python/cp_model) (Constraint Programming – Satisfiability)  
> **Version:** 3.0.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Input Schema](#3-input-schema)
4. [Solve Phases](#4-solve-phases)
5. [Decision Variables](#5-decision-variables)
6. [Hard Constraints](#6-hard-constraints)
7. [Soft Constraints & Objective Function](#7-soft-constraints--objective-function)
8. [Penalty Weights](#8-penalty-weights)
9. [Goal Priorities](#9-goal-priorities)
10. [Fairness System](#10-fairness-system)
11. [Nurse Satisfaction Score](#11-nurse-satisfaction-score)
12. [Output Schema](#12-output-schema)
13. [Capacity Math](#13-capacity-math)
14. [Known Limitations](#14-known-limitations)

---

## 1. Overview

The MayWin solver automatically generates monthly nurse schedules for a hospital unit. Given a list of nurses, a scheduling horizon (days), shift types, and staffing demand, it finds an assignment of nurses to shifts that:

1. **Covers all required staffing demand** (primary goal)
2. **Minimizes staff cost / overtime** (secondary goal)
3. **Respects nurse preferences** (tertiary goal)
4. **Distributes workload fairly** (quaternary goal)

The solver is implemented as a **CP-SAT constraint satisfaction model** — a branch-and-bound integer programming engine that proves optimality or returns the best solution found within a time limit.

---

## 2. System Architecture

```
NestJS Backend
     │
     ▼
SolverAdapter (solver.adapter.ts)
     │  Converts NormalizedInput.v1 → SolveRequest JSON
     │  Spawns child process
     ▼
solver_cli.py  ──────── (Python / OR-Tools CP-SAT)
     │
     ├── Phase 1: build_solver_model(emergency_mode=False)
     │       Hard coverage constraint: assigned == demand
     │
     └── Phase 2: build_solver_model(emergency_mode=True)
             Soft coverage: assigned + under >= demand
             Used only if Phase 1 is infeasible
```

The TypeScript adapter (`solver.adapter.ts`) writes the request payload to a temporary JSON file, spawns `solver_cli.py --cli --input <file> --output <file>`, reads back the result, and cleans up the temp files.

### Shift Name Detection

The solver identifies shift types by **case-insensitive exact match** on the shift array values:

| Array value | Detected as |
|---|---|
| `"morning"` | Morning shift — label constraints active |
| `"evening"` | Evening shift — label constraints active |
| `"night"` | Night shift — label constraints active |
| `"M"`, `"A"`, `"N"` | **Not detected** — label constraints silently disabled |

> [!WARNING]
> The production normalizer currently sends short codes (`M`, `A`, `N`). This means all label-based constraints (night cap, night-to-morning forbid, shift-type limits, evening→night penalty, etc.) are **silently inactive in production**. This is a known mismatch.

---

## 3. Input Schema

```json
{
  "nurses":  ["N1", "N2", "N3"],
  "days":    ["2026-04-01", "2026-04-02", "..."],
  "shifts":  ["morning", "evening", "night"],
  "demand":  {
    "2026-04-01": { "morning": 2, "evening": 2, "night": 1 }
  },

  "availability":  { "N1": { "2026-04-01": { "morning": 0 } } },
  "preferences":   { "N1": { "2026-04-01": { "night": 5 } } },
  "nurse_skills":  { "N1": ["Senior"] },
  "required_skills": { "2026-04-01": { "morning": { "Senior": 1 } } },

  "backup_nurses":              ["N3"],
  "regular_shifts_per_nurse":   { "N1": 20 },
  "max_overtime_per_nurse":     { "N1": 8 },
  "min_total_shifts_per_nurse": { "N1": 15 },

  "rules":    { ... },
  "weights":  { ... },
  "goal_priority":    { "coverage": 1, "cost": 2, "preference": 3, "fairness": 4 },
  "fairness_weights": { "workload_balance": 1, "night_balance": 1, "shift_type_balance": 1 },

  "time_limit_sec":    20.0,
  "num_search_workers": 8,
  "random_seed":        null,
  "enable_cp_sat_log":  false
}
```

### Availability vs Preferences

| Field | Meaning | Effect |
|---|---|---|
| `availability[n][d][s] = 0` | Nurse **cannot** work this slot | Hard block — assignment forced to 0 |
| `availability[n][d][s] = 1` | Nurse **can** work (default) | No effect on objective |
| `preferences[n][d][s] = P` | Nurse **dislikes** this slot (penalty P) | Soft — adds `P × weight` to objective |

---

## 4. Solve Phases

The solver uses a **two-phase strategy** to guarantee a response even when the problem is infeasible under strict rules:

```
Phase 1 — Strict Mode
  ├── Coverage is HARD: sum(x[n,d,s]) == demand[d][s]
  ├── All hard constraints enforced (availability, overtime cap, night cap, …)
  └── If OPTIMAL or FEASIBLE with zero understaffing → DONE ✓

Phase 2 — Emergency Mode (only if Phase 1 fails)
  ├── Coverage is SOFT: sum(x[n,d,s]) + under[d,s] >= demand[d][s]
  ├── under[d,s] penalized heavily in objective (2,000,000 × priority_scale)
  ├── max_shifts_per_day raised to 2 (if allow_second_shift_same_day_in_emergency)
  ├── Night weekly cap becomes soft (penalized instead of hard)
  ├── Rest-hour rules become soft (penalized instead of hard)
  └── Shift-type limits become soft (excess penalized)

If Phase 2 is also INFEASIBLE → status = "INFEASIBLE"
```

### Status Codes

| Status | Meaning |
|---|---|
| `OPTIMAL` | Phase 1 solved; proven globally optimal |
| `FEASIBLE` | Phase 1 solved within time limit; not proven optimal |
| `EMERGENCY_OPTIMAL` | Phase 2 solved; proven optimal (may have understaffing) |
| `EMERGENCY_FEASIBLE` | Phase 2 solved within time limit |
| `INFEASIBLE` | Both phases failed; no schedule possible |
| `ERROR` | Exception or CLI crash |
| `TIMEOUT` | Solver process killed by wall-clock time limit |

---

## 5. Decision Variables

The model creates one **binary variable per (nurse, day, shift) triple**:

```
x[n, d, s] ∈ {0, 1}
  1 = nurse n is assigned to shift s on day d
  0 = not assigned
```

Supporting variables:

| Variable | Type | Purpose |
|---|---|---|
| `over[n]` | IntVar ≥ 0 | Overtime shifts for nurse n |
| `under[d,s]` | IntVar ≥ 0 | Missing staff for slot (d, s) — Phase 2 only |
| `override[n,d,s]` | BoolVar | Emergency override flag (currently always 0 — availability is always hard) |
| `extra_ot[n,d]` | BoolVar | 1 if nurse n works both morning and evening on day d |
| `ev_nt[n,d]` | BoolVar | 1 if nurse n works both evening and night on day d |

---

## 6. Hard Constraints

Hard constraints are **rules the solver must never break** when building the schedule. If even one hard constraint cannot be satisfied, the solver escalates to **emergency mode** (Phase 2) where it tries its best but signals that something is understaffed. Think of these as the legal minimums — the non-negotiables every schedule must obey.

---

### 6.1 — Every shift slot must be filled (Coverage)

**What it means:** The schedule must have exactly the right number of nurses on every shift, every day. No slot can be left empty.

**Example:**
> The unit requires **5 nurses on morning, 5 on afternoon, and 4 on night** every weekday.  
> On weekends, it drops by 1: **4 morning, 4 afternoon, 3 night**.  
>
> The solver *must* find nurses to fill all of those slots for every single day of the month — a weekday morning with only 4 nurses assigned would be a violation.

**What happens if it's impossible?** If there simply aren't enough nurses to cover all slots (e.g., too many nurses have days off that week), the solver enters **emergency mode**. In emergency mode, coverage becomes a soft goal with an enormous penalty — the solver still tries to fill every slot, but it will report which slots are understaffed rather than crashing.

---

### 6.2 — Nurse availability must be respected (Availability)

**What it means:** If a nurse has marked a day or shift as unavailable (e.g., annual leave, sick leave, or a pre-approved day off), the solver will **never** assign them to that slot, period. This rule is never overridden, even in emergency mode.

**Example:**
> Nurse A has submitted annual leave for 15 April.  
> Even if the night shift on 15 April is critically understaffed, the solver will not put Nurse A there.  
> It will instead report "1 nurse missing on night, 15 April" in the understaffed list.

**Note:** Availability marked as `PREFERRED` only signals the nurse *can* work that shift — it does not block them from being assigned to other shifts on the same day unless explicit `UNAVAILABLE` rows are added for those other shifts.

---

### 6.3 — One shift per day per nurse (Daily Shift Limit)

**What it means:** By default, a nurse can only work **one shift per day** — they cannot be assigned to morning *and* night on the same calendar day.

**Example:**
> Nurse B is already assigned to the morning shift on 3 May.  
> The solver cannot also put Nurse B on the evening or night shift on 3 May.

**Exception in emergencies:** If the unit is critically short-staffed and `allow_second_shift_same_day_in_emergency` is enabled, the solver *may* assign a nurse to 2 shifts on the same day as a last resort — but it will incur a heavy penalty and be flagged clearly in the output.

---

### 6.4 — Overtime must stay within budget (Overtime Cap)

**What it means:** Each nurse has a **regular quota** of shifts per month (e.g., 20 shifts). Anything above that quota counts as overtime. The total overtime for any nurse cannot exceed a set maximum (default: **12 overtime shifts** per month).

**Example:**
> Nurse C's regular quota is 20 shifts.  
> The solver can assign her at most 32 shifts total (20 regular + 12 overtime).  
> Assigning her a 33rd shift would break this rule.

**Also:** If a nurse works both the **morning and afternoon on the same day**, that double-shift automatically adds 1 to their overtime count — even if their total shift count is still within the regular quota.

---

### 6.5 — Every nurse must work at least a minimum number of shifts (Minimum Shifts)

**What it means:** To ensure no nurse is left idle the whole month (e.g., part-time contracts guarantee a floor), each nurse must be assigned *at least* a configured number of shifts.

**Example:**
> A part-time nurse has a contract guaranteeing at least **10 shifts per month**.  
> The solver must give her 10 or more shifts — it cannot assign her only 7 even if coverage is already met.

---

### 6.6 — No night shift immediately followed by a morning shift (Night → Morning)

**What it means:** If a nurse finishes a night shift (which ends at 06:00), she cannot start a morning shift the very next day (which begins at 06:00 the same morning she just finished). There is zero rest time between them.

**Example:**
> Nurse D works the night shift on Tuesday (22:00 Tuesday → 06:00 Wednesday).  
> She **cannot** be assigned the morning shift on Wednesday (06:00–14:00).  
> She can, however, work the afternoon shift on Wednesday (14:00–22:00) — that gives her an 8-hour gap.

> [!IMPORTANT]
> This rule is **on by default** and is one of the most important worker safety rules in the scheduler. Disabling it risks placing nurses on back-to-back shifts with no rest.

---

### 6.7 — No morning and night on the same day (Morning → Night, optional)

**What it means:** A nurse cannot be assigned to the morning shift *and* the night shift on the same calendar day — that would be a 16-hour stretch with only a 2-hour break in between.

**Example:**
> Nurse E is on morning shift Monday (06:00–14:00).  
> She **cannot** also be assigned the night shift Monday (22:00–06:00).

**Default status:** This rule is **off by default** (the solver only forbids the back-to-back problem in 6.6). Enable it with `forbid_morning_to_night_same_day = true` if your unit policy requires it.

---

### 6.8 — No more than 2 night shifts per week (Weekly Night Cap)

**What it means:** In any given 7-day week, a nurse can work at most **2 night shifts** (configurable). Night shifts are harder on the body, so rotating them limits fatigue.

**Example:**
> During the week of 7–13 April, Nurse F works nights on Monday and Thursday.  
> The solver will not assign her a third night that same week — Friday night would be off-limits for her.

**In emergency mode:** This becomes a soft rule — the solver can exceed 2 nights per week but will penalise each excess night shift heavily.

---

### 6.9 — At least 2 days off per week (Weekly Days Off)

**What it means:** Every nurse must have a minimum of **2 full days off** in each 7-day week. A "day off" means they are not assigned to *any* shift that day.

**Example:**
> In the week of 14–20 April, a nurse works Monday, Tuesday, Wednesday, Thursday, and Friday — that's 5 days on.  
> The solver ensures she has **at least 2 days off**, so Saturday and Sunday would be free.  
>
> If the weekly schedule is shorter (e.g., only 5 days in the horizon), the cap adjusts accordingly.

---

### 6.10 — At least 11 days off per month (Monthly Days Off)

**What it means:** Over the full scheduling horizon (typically 30 days), each nurse must have at least **11 days off total** — meaning she can work a maximum of **19 days** in a month.

**Example:**
> April has 30 days.  
> Nurse G can be assigned to a maximum of **19 working days** (30 − 11 = 19).  
> Regardless of how urgent the staffing need is, the solver will not schedule her for a 20th day.

> [!IMPORTANT]
> This is one of the main capacity-limiting rules. With 6 nurses × 19 max days = 114 nurse-days available, if total demand exceeds that, the schedule will be understaffed even before overtime is considered.

---

### 6.11 — No more than N consecutive working days (Consecutive Work Days, optional)

**What it means:** A nurse cannot be scheduled to work more than a set number of days in a row without a day off in between. This prevents exhausting stretches of non-stop work.

**Example (if set to 5):**
> Nurse H works Monday through Friday — that's 5 days in a row.  
> She **must** have at least one day off on Saturday or Sunday before she can work again on Monday.  
> The solver would not allow Mon–Tue–Wed–Thu–Fri–Sat (6 days straight).

**Default status:** **Disabled** by default (`null`). Enable it by setting `max_consecutive_work_days` to a number in the constraint profile.

---

### 6.12 — No more than 3 consecutive night shifts (Consecutive Nights)

**What it means:** A nurse cannot be scheduled for more than **3 night shifts in a row**. Running nights for 4+ nights straight causes severe sleep disruption and is considered unsafe.

**Example:**
> Nurse I works nights on Monday, Tuesday, and Wednesday.  
> The solver will **not** also assign her Thursday night — she must have at least one non-night shift (or a day off) before being allowed another night.

---

### 6.13 — No more than N shifts in a row across the full timeline (Consecutive Shifts, optional)

**What it means:** This is a stricter version of 6.11. Instead of counting *working days*, it counts individual **shift slots** back-to-back across days — treating the schedule as one long sequence: Mon-morning → Mon-evening → Mon-night → Tue-morning → ...

**Example (if set to 3):**
> Nurse J works Mon-morning, Mon-evening, Mon-night. That's 3 consecutive slots — at the limit.  
> The solver won't also assign her Tue-morning (that would be a 4th consecutive slot).

**Default status:** **Disabled** by default (`null`). Rarely used; most units rely on 6.11 and 6.12 instead.

---

### 6.14 — Minimum rest hours between consecutive shifts (Rest Hours, optional)

**What it means:** The solver checks the actual clock times of adjacent shifts. If the gap between the end of one shift and the start of the next is shorter than the required minimum rest, that combination is forbidden.

**Shift timetable used:**
| Shift | Start | End |
|---|---|---|
| Morning | 06:00 | 14:00 |
| Afternoon/Evening | 14:00 | 22:00 |
| Night | 22:00 | 06:00 (next day) |

**Example (if minimum rest = 11 hours):**
> Nurse K finishes an **evening shift** at 22:00 on Monday.  
> She cannot start a **morning shift** at 06:00 on Tuesday — that's only 8 hours of rest, below the 11-hour minimum.  
> She *can* start an afternoon shift at 14:00 on Tuesday (16-hour gap ✓).

**In emergency mode:** This becomes soft — violations are penalised but allowed as a last resort.

**Default status:** **Disabled** by default (`null`). Enable by setting `min_rest_hours_between_shifts`.

---

### 6.15 — No nurse can work too many of the same shift type per month (Shift-Type Limits)

**What it means:** To prevent a nurse from being stuck on nights all month, there is a cap on how many times she can be assigned to each shift type. Default is **9 per type** (so no more than 9 mornings, 9 afternoons, and 9 nights per nurse per month).

**Example:**
> By mid-April, Nurse L has already worked 9 morning shifts.  
> Even if the morning shift is severely short-staffed in the last week of April, the solver will not assign her another morning.  
> She can still be assigned afternoons or nights if she hasn't hit those caps.

**Exceptions:** Specific nurses can be listed in `shift_type_limit_exempt_nurses` to skip this rule (e.g., a specialist who only ever works mornings).

**In emergency mode:** The solver may exceed the cap but penalises each extra shift of that type.

---

### 6.16 — Skilled slots must have qualified nurses (Skill Requirements)

**What it means:** Some shifts require at least one nurse with a specific qualification — for example, every morning shift must have at least 1 Senior nurse on site. The solver will only assign nurses who have the required tag/skill to fill those positions.

**Example:**
> The ICU requires **1 Senior nurse on every shift, every day**.  
> The unit has 8 nurses total, but only 3 are tagged as `"Senior"`.  
> The solver will always include at least one of those 3 nurses on every shift — regardless of their preference or workload — because the skill requirement is a hard constraint.  
> If none of the 3 Senior nurses are available on a given day, the solver will report that shift as understaffed.

---

---

## 7. Soft Constraints & Objective Function

The solver **minimizes** a weighted sum of penalty terms. All soft constraints appear as terms in this objective.

```
Minimize:
  coverage_penalty          (understaffed slots)
  + overtime_penalty        (total overtime shifts)
  + overtime_balance_penalty (spread overtime fairly)
  + preference_penalty      (nurse preference violations)
  + workload_balance        (max − min total shifts)
  + night_balance           (max − min night shifts)
  + shift_type_balance      (max − min shift types per nurse)
  + backup_nurse_penalty    (cost of using backup staff)
  + evening_to_night_penalty (evening + night same day)
  + same_day_second_shift   (double-shift in emergency)
  + emergency_override      (any emergency override used)
  + shift_type_excess       (over shift-type cap in emergency)
```

### 7.1 Coverage Penalty (Phase 2 only)

```
priority_scale[coverage] × understaff_penalty × under[d,s]
```
This is the **highest-priority** term. With `priority_scale[coverage] = 10,000,000` and `understaff_penalty = 2,000,000`, understaffing is extremely expensive.

### 7.2 Overtime Penalty

```
overtime_penalty × over[n]   ∀ n
```
Penalizes each overtime shift. Default weight: 20.

### 7.3 Preference Penalty

```
priority_scale[preference] × preference_penalty_multiplier × p × x[n,d,s]
```
Where `p = preferences[n][d][s]` is the nurse's dislike score for that slot. Higher `p` = stronger dislike.

### 7.4 Evening → Night Same Day (HIGH penalty)

```
evening_to_night_penalty × ev_nt[n,d]
```
Penalizes assigning a nurse to both evening and night on the same day. Default weight: **10,000** — almost as expensive as an understaffed slot, making this effectively a near-hard constraint.

### 7.5 Backup Nurse Penalty

```
50,000 × x[n,d,s]   ∀ n in backup_nurses, d, s
```
Makes the solver strongly prefer regular nurses over backup/agency staff.

### 7.6 Emergency Same-Day Double Shift

```
same_day_second_shift_penalty × extra_same_day[n,d]
```
In emergency mode, penalizes each double shift per nurse per day. Default weight: 150.

---

## 8. Penalty Weights

All weights are configurable in the request's `weights` object.

| Field | Default | Description |
|---|---|---|
| `understaff_penalty` | 2,000,000 | Cost per missing nurse on a slot (Phase 2) |
| `overtime_penalty` | 20 | Cost per overtime shift |
| `preference_penalty_multiplier` | 1 | Multiplier on nurse dislike scores |
| `workload_balance_weight` | 0 | Weight for equalizing total shifts (off by default) |
| `emergency_override_penalty` | 500 | Cost per emergency rule override |
| `same_day_second_shift_penalty` | 150 | Cost per double shift in emergency |
| `weekly_night_over_penalty` | 120 | Cost per excess night shift over weekly cap |
| `evening_to_night_penalty` | 10,000 | Cost for evening + night same day |
| `shift_type_balance_penalty` | 100 | Cost for imbalance across shift types per nurse |
| `overtime_balance_penalty` | 1,000 | Cost for imbalance in overtime across nurses |

---

## 9. Goal Priorities

Goals are ordered by priority (1 = highest). Each priority maps to a **scale multiplier**:

| Priority rank | Scale multiplier |
|---|---|
| 1 | 10,000,000 |
| 2 | 10,000 |
| 3 | 1,000 |
| 4 | 100 |

Default priority order:

| Goal | Default Priority |
|---|---|
| `coverage` | **1** (most important) |
| `cost` | 2 |
| `preference` | 3 |
| `fairness` | 4 |

The priority scales ensure goals at a higher priority dominate the objective even when lower-priority penalties have large coefficients.

---

## 10. Fairness System

Three fairness metrics are tracked and penalized:

### Workload Balance

```
workload_balance = max_total_shifts - min_total_shifts   (across all nurses)
penalty = priority_scale[fairness] × fairness_weights.workload_balance × workload_balance
```

### Night Shift Balance

```
night_balance = max_night_shifts - min_night_shifts   (across all nurses)
penalty = priority_scale[fairness] × fairness_weights.night_balance × night_balance
```

### Shift-Type Balance (per nurse)

```
shift_balance[n] = max(morning, evening, night) - min(morning, evening, night)
penalty = shift_type_balance_penalty × priority_scale[fairness] × fairness_weights.shift_type_balance × shift_balance[n]
```

This per-nurse metric discourages loading a nurse with too many of one shift type.

### Overtime Balance

```
overtime_balance = max_overtime - min_overtime   (across all nurses)
penalty = overtime_balance_penalty × priority_scale[fairness] × overtime_balance
```

---

## 11. Nurse Satisfaction Score

After solving, each nurse receives a satisfaction score from **1 to 100**:

```
score = 100
  − (disliked_shifts / total_shifts) × 40    # up to −40 for preference violations
  − (night_shifts / total_shifts) × 20        # up to −20 for high night ratio
  − min(30, overtime_count × 5)               # up to −30 for overtime
  − min(30, emergency_override_count × 10)    # up to −30 for emergencies
```

The final score is clamped to `[1, 100]`.

---

## 12. Output Schema

```json
{
  "status": "OPTIMAL",
  "objective_value": 12345,
  "assignments": [
    { "day": "2026-04-01", "shift": "morning", "nurse": "N1", "emergency_override": false }
  ],
  "understaffed": [
    { "day": "2026-04-15", "shift": "night", "missing": 1 }
  ],
  "nurse_stats": [
    {
      "nurse": "N1",
      "assigned_shifts": 19,
      "overtime": 3,
      "morning_shifts": 7,
      "evening_shifts": 6,
      "night_shifts": 6,
      "satisfaction": 82
    }
  ],
  "details": {
    "average_satisfaction": 84.5,
    "coverage_missing": 0,
    "additional_nurses_required": 0,
    "emergency_override_count": 0,
    "best_bound": 12345,
    "wall_time_sec": 3.2,
    "conflicts": 820,
    "branches": 4500
  }
}
```

> [!NOTE]
> `morning_shifts`, `evening_shifts`, `night_shifts` in `nurse_stats` are **always 0** if shift codes like `"M"`, `"A"`, `"N"` are used instead of full lowercase names, because `find_shift_name()` cannot detect them.

---

## 13. Capacity Math

With the **default rules** over a 30-day month:

| Constraint | Limit |
|---|---|
| `min_total_days_off = 11` | Max 19 working days |
| `max_shifts_per_day = 1` | Max 19 shifts/month (Phase 1) |
| `max_shifts_per_day = 2` (emergency) | Max 38 shifts/month (Phase 2) |
| `max_overtime_per_nurse = 12` | Upper bound: regular + 12 |

**Required demand example:** 3 morning + 3 evening + 2 night = **8 slots/day × 30 days = 240 slots/month**

| Nurses | Max supply (Phase 2) | Feasible? |
|---|---|---|
| 6 | 6 × 38 = 228 | ❌ Short by 12 |
| 7 | 7 × 38 = 266 | ✅ Enough |
| 8 | 8 × 38 = 304 | ✅ Comfortable |

---

## 14. Known Limitations

| Issue | Impact | Workaround |
|---|---|---|
| Production sends short shift codes (`M`, `A`, `N`) | Night cap, shift-type limits, night-to-morning, evening→night penalty all silently disabled | Rename shifts to `"morning"`, `"evening"`, `"night"` in the normalizer |
| Availability is always hard | Cannot override nurse day-off even in extreme emergency | Not currently needed — by design |
| `max_consecutive_work_days` and `max_consecutive_shifts` are `null` by default | Sliding window constraints inactive unless explicitly set | Set in `ConstraintProfile` |
| Senior skill constraint only checks `"Senior"` tag | Other required skills are ignored | Extend `required_skills` logic for new skill types |
| Solver time limit is wall-clock | Large instances with many nurses may return `FEASIBLE` (not proven optimal) | Increase `time_limit_sec` or reduce `num_search_workers` |

---

*Generated from `solver_cli.py` v3.0.0 — last reviewed 2026-05-01*
