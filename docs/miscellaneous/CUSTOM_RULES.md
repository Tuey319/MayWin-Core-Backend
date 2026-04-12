# Custom Rules — Implementation Proposal

> Extends the solver to support hospital-specific scheduling constraints configured
> per `ConstraintProfile`, with no code changes required per hospital.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Design Overview](#2-design-overview)
3. [Rule Catalog](#3-rule-catalog)
4. [Data Flow](#4-data-flow)
5. [Layer-by-Layer Changes](#5-layer-by-layer-changes)
   - [5.1 Database Migration](#51-database-migration)
   - [5.2 TypeScript Entity](#52-typescript-entity)
   - [5.3 NormalizerService](#53-normalizerservice)
   - [5.4 SolverAdapter](#54-solveradapter)
   - [5.5 Python SolveRequest Model](#55-python-solverequest-model)
   - [5.6 Python Constraint Interpreter](#56-python-constraint-interpreter)
6. [Example Profile Configuration](#6-example-profile-configuration)
7. [Validation Rules](#7-validation-rules)
8. [Adding a New Rule Type](#8-adding-a-new-rule-type)
9. [What Still Requires a Code Change](#9-what-still-requires-a-code-change)

---

## 1. Problem Statement

Every hospital has scheduling rules beyond the common set already implemented
(`forbid_night_to_morning`, `max_nights_per_week`, etc.). Currently, supporting
a new hospital-specific rule requires editing `solver_cli.py` source code and
deploying a new version.

Examples of rules that can't currently be configured without code changes:

- "No nurse may work more than 3 consecutive Evening shifts"
- "After any Night shift, the nurse must have at least 16 hours off"
- "Senior nurses (tag: SENIOR) must appear on at least 2 Weekend shifts per month"
- "Nurse A and Nurse B may not work the same shift together"

The goal is to make these expressible as data in the `ConstraintProfile`, so a
new hospital can be onboarded entirely through the API with no deployment.

---

## 2. Design Overview

A single new JSONB column `custom_rules` is added to `constraint_profiles`.
It holds an array of rule specification objects. Each object has a `type` string
and a `params` object specific to that type.

```json
{
  "custom_rules": [
    { "type": "forbidden_sequence",         "params": { "from": "Night",   "to": "Morning", "within_days": 1 } },
    { "type": "max_consecutive_shifts",     "params": { "shift": "Evening", "limit": 3 } },
    { "type": "min_rest_hours",             "params": { "hours": 16 } },
    { "type": "max_shifts_by_type_per_period", "params": { "shift": "Night", "max": 6, "period": "month" } }
  ]
}
```

The rules are passed through the existing pipeline unchanged and interpreted by
the Python solver when building the CP-SAT model.

**Key design decisions:**

- Rules are additive — they layer on top of the existing hardcoded constraints.
- An unknown `type` is skipped silently (no crash, logged as a warning).
- Rules are enforced as hard CP-SAT constraints, not soft penalties. They cannot
  be violated even in emergency mode (unless relaxed explicitly — see Section 7).
- The existing named flags (`forbid_night_to_morning`, etc.) are not migrated
  into this system. They remain as first-class fields for performance and clarity.

---

## 3. Rule Catalog

### `forbidden_sequence`

Prevents shift `from` from being followed by shift `to` within `within_days` calendar days.

```json
{
  "type": "forbidden_sequence",
  "params": {
    "from": "Evening",
    "to": "Morning",
    "within_days": 1
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | Shift code (case-insensitive match) |
| `to` | string | yes | Shift code (case-insensitive match) |
| `within_days` | int ≥ 1 | no (default: 1) | How many days forward to block |

---

### `max_consecutive_shifts`

Limits how many consecutive days a nurse can work a given shift type (or any shift).

```json
{
  "type": "max_consecutive_shifts",
  "params": {
    "shift": "Night",
    "limit": 3
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `shift` | string | no | Shift code to limit. Omit to limit any shift. |
| `limit` | int ≥ 1 | yes | Max consecutive days |

---

### `min_rest_hours`

Requires a minimum number of hours between any two consecutive shifts for a nurse.
Uses shift start/end times from shift templates.

```json
{
  "type": "min_rest_hours",
  "params": {
    "hours": 11
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `hours` | int ≥ 0 | yes | Minimum rest hours between shifts |

> Note: The existing `min_rest_hours_between_shifts` column on `ConstraintProfile`
> does the same thing for all shifts globally. Use this custom rule when you need
> a different minimum for a specific shift pair.

---

### `max_shifts_by_type_per_period`

Caps how many times a nurse can be assigned a particular shift within a week or the full schedule period.

```json
{
  "type": "max_shifts_by_type_per_period",
  "params": {
    "shift": "Night",
    "max": 6,
    "period": "month"
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `shift` | string | yes | Shift code |
| `max` | int ≥ 0 | yes | Maximum count |
| `period` | `"week"` \| `"month"` | no (default: `"month"`) | Scope of the cap |

---

### `min_shifts_by_type_per_period`

Requires a nurse to work at least a certain number of a given shift type.

```json
{
  "type": "min_shifts_by_type_per_period",
  "params": {
    "shift": "Morning",
    "min": 4,
    "period": "month"
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `shift` | string | yes | Shift code |
| `min` | int ≥ 0 | yes | Minimum count |
| `period` | `"week"` \| `"month"` | no (default: `"month"`) | Scope |

---

### `required_day_off_pattern`

Enforces a rolling work/rest pattern: after `work_days` consecutive working days,
the nurse must have at least `off_days` consecutive days off.

```json
{
  "type": "required_day_off_pattern",
  "params": {
    "work_days": 5,
    "off_days": 2
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `work_days` | int ≥ 1 | yes | Max consecutive working days before rest |
| `off_days` | int ≥ 1 | yes | Min consecutive rest days required after |

---

### `tag_minimum_presence`

Requires that at least `min_count` nurses with a given tag are assigned to a
specific shift on every day of the schedule.

```json
{
  "type": "tag_minimum_presence",
  "params": {
    "tag": "SENIOR",
    "shift": "Night",
    "min_count": 1
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `tag` | string | yes | Nurse tag (from `worker.attributes.tags`) |
| `shift` | string | yes | Shift code |
| `min_count` | int ≥ 1 | yes | Minimum nurses with this tag per day |

> Note: For coverage-rule-level skill requirements, use `coverage_rules.required_tag`
> instead. This rule is for global per-shift presence requirements that apply every day.

---

## 4. Data Flow

```
constraint_profiles.custom_rules  (JSONB in PostgreSQL)
         │
         │  NormalizerService.resolveConstraintProfile()
         │  maps:  cp.custom_rules  →  constraints.customRules
         ▼
NormalizedInputV1.constraints.customRules  (in-memory / S3 artifact)
         │
         │  SolverAdapter.toSolveRequest()
         │  passes:  customRules  →  custom_rules
         ▼
Python SolveRequest JSON  { "custom_rules": [...] }  (written to /tmp/in-<id>.json)
         │
         │  solver_cli.py  SolveRequest Pydantic model parses it
         ▼
req.custom_rules: List[Dict[str, Any]]
         │
         │  build_solver_model()  interpreter loop
         │  for each rule → model.Add(...) or model.AddImplication(...)
         ▼
CP-SAT model constraints  (enforced during solve)
```

Each arrow is a discrete code change. All 5 must be made together — the feature
is inert until all layers are connected.

---

## 5. Layer-by-Layer Changes

### 5.1 Database Migration

Generate a new TypeORM migration:

```bash
npx typeorm migration:generate src/database/migrations/AddCustomRulesToConstraintProfiles \
  -d src/database/data-source.ts
```

The migration should contain:

```sql
ALTER TABLE maywin_db.constraint_profiles
  ADD COLUMN IF NOT EXISTS custom_rules jsonb NOT NULL DEFAULT '[]'::jsonb;
```

---

### 5.2 TypeScript Entity

**File:** [src/database/entities/scheduling/constraint-profile.entity.ts](../src/database/entities/scheduling/constraint-profile.entity.ts)

Add before the `attributes` column (around line 150):

```typescript
/**
 * Hospital-specific custom constraint rules passed to the Python solver.
 * Each entry is a { type, params } object. See docs/CUSTOM_RULES.md for
 * the full rule catalog.
 */
@Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
custom_rules: Array<{ type: string; params: Record<string, any> }>;
```

---

### 5.3 NormalizerService

**File:** [src/core/normalizer/normalizer.service.ts](../src/core/normalizer/normalizer.service.ts)

In `resolveConstraintProfile()`, add to the return object:

```typescript
// existing fields ...
goalReduceUndesirableShifts: cp?.goal_reduce_undesirable_shifts ?? true,

// ADD THIS:
customRules: Array.isArray(cp?.custom_rules) ? cp.custom_rules : [],
```

This makes `customRules` available on `NormalizedInputV1.constraints`.

---

### 5.4 SolverAdapter

**File:** [src/core/solver/solver.adapter.ts](../src/core/solver/solver.adapter.ts)

In `toSolveRequest()`, after the existing optional field appends (around line 413):

```typescript
// existing:
if (Object.keys(requiredSkills).length > 0) req.required_skills = requiredSkills;

// ADD THIS:
const customRules = cp.customRules;
if (Array.isArray(customRules) && customRules.length > 0) {
  req.custom_rules = customRules;
}
```

---

### 5.5 Python SolveRequest Model

**File:** [src/core/solver/solver_cli.py](../src/core/solver/solver_cli.py)

In the `SolveRequest` Pydantic model (around line 89), add:

```python
custom_rules: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
```

---

### 5.6 Python Constraint Interpreter

**File:** [src/core/solver/solver_cli.py](../src/core/solver/solver_cli.py)

In `build_solver_model()`, after all existing hardcoded constraints are applied,
add the interpreter loop:

```python
# ── Custom rules (hospital-specific, profile-configured) ─────────────────
for rule in (req.custom_rules or []):
    rule_type = rule.get("type")
    params    = rule.get("params", {})

    # ── forbidden_sequence ────────────────────────────────────────────────
    if rule_type == "forbidden_sequence":
        from_s  = find_shift_name(shifts, params.get("from", ""))
        to_s    = find_shift_name(shifts, params.get("to", ""))
        within  = max(1, int(params.get("within_days", 1)))
        if from_s and to_s:
            for n in nurses:
                for i, d in enumerate(days[:-within]):
                    for fd in days[i + 1 : i + 1 + within]:
                        model.AddImplication(
                            x[(n, d, from_s)],
                            x[(n, fd, to_s)].Not()
                        )

    # ── max_consecutive_shifts ────────────────────────────────────────────
    elif rule_type == "max_consecutive_shifts":
        limit  = max(1, int(params.get("limit", 5)))
        target = find_shift_name(shifts, params.get("shift", "")) if params.get("shift") else None
        for n in nurses:
            for i in range(len(days) - limit):
                window = days[i : i + limit + 1]
                if target:
                    model.Add(sum(x[(n, d, target)] for d in window) <= limit)
                else:
                    model.Add(
                        sum(x[(n, d, s)] for d in window for s in shifts) <= limit
                    )

    # ── min_rest_hours ────────────────────────────────────────────────────
    elif rule_type == "min_rest_hours":
        min_hours = int(params.get("hours", 11))
        for n in nurses:
            for i, d in enumerate(days[:-1]):
                next_d = days[i + 1]
                for s1 in shifts:
                    for s2 in shifts:
                        if violates_rest(s1, s2, min_hours, hours_map):
                            model.AddImplication(
                                x[(n, d, s1)],
                                x[(n, next_d, s2)].Not()
                            )

    # ── max_shifts_by_type_per_period ─────────────────────────────────────
    elif rule_type == "max_shifts_by_type_per_period":
        target    = find_shift_name(shifts, params.get("shift", ""))
        max_count = int(params.get("max", 99))
        period    = params.get("period", "month")
        if target:
            if period == "week":
                for week_days in weeks.values():
                    for n in nurses:
                        model.Add(
                            sum(x[(n, d, target)] for d in week_days) <= max_count
                        )
            else:
                for n in nurses:
                    model.Add(
                        sum(x[(n, d, target)] for d in days) <= max_count
                    )

    # ── min_shifts_by_type_per_period ─────────────────────────────────────
    elif rule_type == "min_shifts_by_type_per_period":
        target    = find_shift_name(shifts, params.get("shift", ""))
        min_count = int(params.get("min", 0))
        period    = params.get("period", "month")
        if target:
            if period == "week":
                for week_days in weeks.values():
                    for n in nurses:
                        model.Add(
                            sum(x[(n, d, target)] for d in week_days) >= min_count
                        )
            else:
                for n in nurses:
                    model.Add(
                        sum(x[(n, d, target)] for d in days) >= min_count
                    )

    # ── required_day_off_pattern ──────────────────────────────────────────
    elif rule_type == "required_day_off_pattern":
        work_days = max(1, int(params.get("work_days", 5)))
        off_days  = max(1, int(params.get("off_days", 2)))
        window    = work_days + off_days
        for n in nurses:
            for i in range(len(days) - window + 1):
                w = days[i : i + window]
                # In any window of (work_days + off_days) days,
                # the nurse cannot work ALL of the first work_days AND also
                # work any of the required off_days.
                # Enforced as: sum of assignments across full window <= work_days.
                model.Add(
                    sum(x[(n, d, s)] for d in w for s in shifts) <= work_days
                )

    # ── tag_minimum_presence ──────────────────────────────────────────────
    elif rule_type == "tag_minimum_presence":
        tag       = str(params.get("tag", ""))
        target    = find_shift_name(shifts, params.get("shift", ""))
        min_count = int(params.get("min_count", 1))
        if tag and target:
            tagged_nurses = [n for n in nurses if has_skill(nurse_skills, n, tag)]
            if tagged_nurses:
                for d in days:
                    model.Add(
                        sum(x[(n, d, target)] for n in tagged_nurses) >= min_count
                    )

    # ── unknown rule type: log and skip ──────────────────────────────────
    else:
        print(f"[solver] WARNING: unknown custom rule type '{rule_type}' — skipped", flush=True)
```

---

## 6. Example Profile Configuration

Hospital with strict rest requirements and a senior-nurse coverage rule:

```json
{
  "name": "ICU Ward — Hospital B",
  "forbid_night_to_morning": true,
  "forbid_evening_to_night": true,
  "max_nights_per_week": 2,
  "min_days_off_per_week": 2,
  "custom_rules": [
    {
      "type": "min_rest_hours",
      "params": { "hours": 16 }
    },
    {
      "type": "max_consecutive_shifts",
      "params": { "shift": "Night", "limit": 3 }
    },
    {
      "type": "tag_minimum_presence",
      "params": { "tag": "SENIOR", "shift": "Night", "min_count": 1 }
    },
    {
      "type": "max_shifts_by_type_per_period",
      "params": { "shift": "Night", "max": 8, "period": "month" }
    }
  ]
}
```

Hospital with a simple rotation pattern:

```json
{
  "name": "General Ward — Hospital C",
  "custom_rules": [
    {
      "type": "required_day_off_pattern",
      "params": { "work_days": 5, "off_days": 2 }
    },
    {
      "type": "forbidden_sequence",
      "params": { "from": "Evening", "to": "Morning", "within_days": 2 }
    }
  ]
}
```

---

## 7. Validation Rules

When saving a `ConstraintProfile` with `custom_rules`, the API should validate:

| Check | Error |
|---|---|
| Each rule has a `type` string | `custom_rules[N].type is required` |
| `type` is a known value from the catalog | `unknown rule type: "xyz"` |
| Required params are present for the type | `custom_rules[N].params.limit is required` |
| Numeric params are in valid range | `limit must be >= 1` |
| Shift codes named in params exist in the unit's shift templates | `shift "X" not found in unit shift templates` |

The last check should be a soft warning (not a blocking error) because shift
templates can change after a profile is saved.

**Where to add this validation:**

`src/core/unit-config/constraint-profiles/constraint-profiles.service.ts`
— in the `create` and `update` methods, before saving to the DB.

---

## 8. Adding a New Rule Type

When a hospital needs a rule not covered by the catalog:

1. Define the rule type name and params schema in this document (Section 3).
2. Add the interpreter case to `build_solver_model()` in `solver_cli.py`.
3. Add validation for the new type in `constraint-profiles.service.ts`.
4. No migration needed — `custom_rules` is freeform JSONB.

One code change covers all hospitals that will ever use the new rule type.

---

## 9. What Still Requires a Code Change

Some rule types cannot be expressed in this system and will always need source
code changes:

| Rule Class | Why it can't be parameterized |
|---|---|
| Rules using data not in the normalized input | e.g., seniority tiers, commute distance, contract type logic |
| Multi-unit float rules | A nurse working across two units in one period — normalizer only handles one unit per job |
| New objective functions | Adding a new term to the CP-SAT objective (not a constraint) requires code in the model builder |
| Rules requiring new solver variables | e.g., tracking "shift sequences as a block" requires new BoolVars |

For these cases, the path is: add the necessary data to `NormalizedInputV1`,
add a new named param to `ConstraintProfile`, and wire it through all 5 layers.
The custom rules system handles constraint *shape* variation; structural solver
changes are always a code change.

---

*For the full solver architecture, see [SOLVER_LOGIC.md](./SOLVER_LOGIC.md).*
*For constraint profile API endpoints, see [API.md](./API.md).*
