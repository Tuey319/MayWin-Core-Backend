# Infeasibility in Constraint-Satisfying Nurse Scheduling

**Date:** 2026-05-02  
**Context:** May 2026 solver failure after nurse request seed applied with `DO UPDATE`

---

## Background: The Problem Structure

The nurse scheduling problem is modeled as a **Constraint Satisfaction Problem (CSP)**, solved using Google's **CP-SAT** (Constraint Programming - Satisfiability) solver. The decision variables are binary:

$$x_{n,d,s} \in \{0, 1\}$$

where $x_{n,d,s} = 1$ means nurse $n$ is assigned to shift $s$ on day $d$. The solver must find an assignment satisfying all constraints simultaneously.

---

## Hard vs. Soft Constraints

Constraints in CP-SAT are either **hard** (must be satisfied for a solution to exist) or **soft** (violations are penalized in the objective function but do not eliminate feasibility).

| Type | Mechanism | Effect if violated |
|------|-----------|-------------------|
| Hard | `model.Add(...)` | Model becomes **INFEASIBLE** |
| Soft | Penalty term in objective | Solution still found, but at higher cost |

The `worker_availability` table encodes nurse availability using two hard-constraint types:

- **`UNAVAILABLE`** → `model.Add(x[n,d,s] == 0)` — absolute prohibition, **never** overridden
- **`DAY_OFF`** → placed in `overridableAvailability` — treated as `UNAVAILABLE` in normal mode, but **demoted to a soft penalty** in emergency phase when `ignoreAvailabilityInEmergency = true`

---

## The Two-Phase Solver Architecture

The solver runs in two sequential phases:

**Phase 1 — Strict mode:** All constraints hard. Exact coverage required:

$$\sum_{n} x_{n,d,s} = \text{demand}_{d,s} \quad \forall\, d, s$$

**Phase 2 — Emergency mode** (triggered when Phase 1 is INFEASIBLE): Coverage constraint relaxed to allow understaffing with penalty. Critically, `DAY_OFF` slots become overridable — the solver *may* assign a nurse to a slot she requested off, at a high penalty cost (`emergency_override_penalty = 50,000`).

This two-phase design is the **safety valve** that ensures a solution always exists as long as there is sufficient total nurse capacity.

---

## What Went Wrong: Constraint Escalation via `DO UPDATE`

The nurse request seed used `UNAVAILABLE` for **leave days** and applied `ON CONFLICT DO UPDATE`, which overwrote existing `DAY_OFF` entries. This caused a **constraint escalation**:

```
DAY_OFF  ──(DO UPDATE)──►  UNAVAILABLE
```

The critical consequence: emergency-mode override of leave days became **impossible**, eliminating the safety valve entirely for those slots.

---

## Feasibility Analysis on a Critical Day

Consider **May 4**, where the nurse requests place 4 nurses on leave:

| Nurse | Status |
|-------|--------|
| NURSE_001 | Morning-only (hard) |
| NURSE_004 | Leave → `UNAVAILABLE` (hard) |
| NURSE_005 | Leave → `UNAVAILABLE` (hard) |
| NURSE_007 | Leave → `UNAVAILABLE` (hard) |
| NURSE_008 | Leave → `UNAVAILABLE` (hard) |

**Available nurses: {NURSE_001, NURSE_002, NURSE_003, NURSE_006} = 4 nurses**

**Coverage demand:** 2 MORNING + 2 EVENING + 2 NIGHT = **6 shift-slots**

With `max_shifts_per_day = 2`, theoretical maximum coverage from 4 nurses is $4 \times 2 = 8$ slots. However:

- `forbidMorningToNightSameDay = true` → eliminates MORNING+NIGHT OT pairs
- `forbidEveningToNight` with penalty 99,999 → effectively eliminates EVENING+NIGHT pairs
- Only valid OT pair: **MORNING + EVENING**

This means NIGHT shifts can only be covered by nurses working a single shift. With NURSE_001 locked to MORNING, the remaining 3 nurses must cover: 1 MORNING + 2 EVENING + 2 NIGHT = 5 slots. At most 2 of those 3 nurses can do OT (M+E), leaving **zero nurses available for NIGHT coverage** once morning and evening are filled.

The CP-SAT solver correctly identifies this as **INFEASIBLE** — no assignment of $x_{n,d,s}$ satisfies the coverage equality constraint for NIGHT on May 4. Because the leave slots are `UNAVAILABLE` (not `DAY_OFF`), emergency mode cannot reassign those nurses, so Phase 2 also fails.

---

## Formal Condition for Infeasibility

A day $d$ is infeasible when:

$$\text{assignable}(d) < \sum_s \text{demand}_{d,s}$$

where $\text{assignable}(d)$ accounts for per-nurse OT limits, same-day shift sequence restrictions, and hard availability blocks. When this holds and no emergency override exists to relax demand, the model has **no feasible region**.

---

## Correct Fix

Leave requests should remain `DAY_OFF` (preserving the emergency override path), while specific shift assignments use `UNAVAILABLE` (hard-locking the shift type only). This restores the solver's two-phase safety valve while still honoring the nurse schedule.

| Nurse request | Correct DB type | Reason |
|--------------|----------------|--------|
| Leave | `DAY_OFF` | Keeps emergency override path open |
| Night shift | `UNAVAILABLE` on MORNING + EVENING | Forces Night; solver still has emergency fallback on the Night slot itself |
| Morning shift | `UNAVAILABLE` on EVENING + NIGHT | Same |
| Evening shift | `UNAVAILABLE` on MORNING + NIGHT | Same |
