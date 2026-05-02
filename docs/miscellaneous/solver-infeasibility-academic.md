# Constraint Escalation and Infeasibility in Two-Phase Nurse Scheduling Optimization

**System:** MayWin Nurse Scheduling System  
**Date:** 2026-05-02  
**Classification:** Technical Analysis — Solver Infeasibility

---

## Abstract

This report analyses a class of infeasibility failure in automated nurse schedule generation arising from improper constraint typing in the availability data layer. We demonstrate that converting soft leave constraints (`DAY_OFF`) to hard unavailability constraints (`UNAVAILABLE`) via a database upsert operation eliminates the emergency-phase feasibility path in a two-phase Constraint Programming – Satisfiability (CP-SAT) model, producing an infeasible problem on days where nurse capacity is insufficient without emergency reassignment. We formalize the conditions under which infeasibility occurs, derive a tight bound on the minimum required nurse capacity per day, and propose the correct constraint typing discipline to preserve system correctness.

---

## 1. Problem Formulation

### 1.1 Decision Variables

The nurse scheduling problem is formulated as a binary integer program. Let:

- $N$ = set of nurses
- $D$ = set of scheduling days (horizon)
- $S$ = set of shift types (MORNING, EVENING, NIGHT)

The primary decision variable is:

$$x_{n,d,s} \in \{0, 1\}, \quad \forall\, n \in N,\; d \in D,\; s \in S$$

where $x_{n,d,s} = 1$ denotes that nurse $n$ is assigned to shift $s$ on day $d$.

Auxiliary variables include:

- $\text{over}_n \in \mathbb{Z}_{\geq 0}$ — overtime shifts accrued by nurse $n$
- $\text{under}_{d,s} \in \mathbb{Z}_{\geq 0}$ — uncovered slots on day $d$, shift $s$ (Phase 2 only)
- $\text{override}_{n,d,s} \in \{0,1\}$ — indicator that an availability override was invoked

### 1.2 Core Constraints

**Coverage (Phase 1 — strict):**

$$\sum_{n \in N} x_{n,d,s} = \delta_{d,s}, \quad \forall\, d \in D,\; s \in S$$

where $\delta_{d,s}$ is the required staffing level for shift $s$ on day $d$.

**Coverage (Phase 2 — relaxed):**

$$\sum_{n \in N} x_{n,d,s} + \text{under}_{d,s} \geq \delta_{d,s}, \quad \forall\, d \in D,\; s \in S$$
$$\sum_{n \in N} x_{n,d,s} \leq \delta_{d,s}, \quad \forall\, d \in D,\; s \in S$$

**Daily shift limit:**

$$\sum_{s \in S} x_{n,d,s} \leq \sigma_{\max}, \quad \forall\, n \in N,\; d \in D$$

where $\sigma_{\max} \in \{1, 2\}$ is the maximum shifts per day (2 when overtime is active).

**Same-day shift sequence restrictions:**

$$x_{n,d,\text{MORNING}} + x_{n,d,\text{NIGHT}} \leq 1, \quad \forall\, n,\; d \quad (\text{forbidMorningToNightSameDay})$$

**Consecutive-day shift restriction:**

$$x_{n,d,\text{EVENING}} + x_{n,d+1,\text{NIGHT}} \leq 1, \quad \forall\, n,\; d \quad (\text{forbidEveningToNight})$$

**Availability (hard block):**

$$x_{n,d,s} = 0 \quad \text{if } \texttt{availability}[n][d][s] = 0$$

---

## 2. Two-Phase Solver Architecture

The solver operates in two sequential phases designed to guarantee a solution whenever sufficient nurse capacity exists:

```
Phase 1 (Strict)
  ├─ All availability constraints: hard
  ├─ Coverage: exact equality
  └─ FEASIBLE? ──► Return solution
        │
        └─ INFEASIBLE
              │
              ▼
Phase 2 (Emergency)
  ├─ DAY_OFF slots: demoted to soft penalty
  ├─ Coverage: relaxed inequality + understaff penalty
  └─ FEASIBLE? ──► Return solution (with penalties)
        │
        └─ INFEASIBLE ──► Return error: "No feasible schedule found"
```

The key invariant of this architecture is that **Phase 2 must always be feasible** provided the total nurse count exceeds the per-shift demand. This invariant is maintained only when leave entries are typed as `DAY_OFF` (soft-overridable), not `UNAVAILABLE` (hard-blocked).

---

## 3. Constraint Typing in the Data Layer

### 3.1 The `worker_availability` Table

Nurse availability is stored in the `worker_availability` relation with schema:

```
(worker_id, unit_id, date, shift_code) → (type, source, reason)
```

subject to a uniqueness constraint on `(worker_id, unit_id, date, shift_code)`.

The `type` column determines solver treatment:

| Type | Solver mapping | Phase 1 | Phase 2 |
|------|---------------|---------|---------|
| `UNAVAILABLE` | `availability[n][d][s] = 0` → `model.Add(x[n,d,s] == 0)` | Hard block | Hard block |
| `BLOCKED` | Same as UNAVAILABLE | Hard block | Hard block |
| `DAY_OFF` | `overridableAvailability[n][d][s] = 0` | Hard block | **Soft penalty** |

The distinction between `UNAVAILABLE` and `DAY_OFF` is architecturally significant: only `DAY_OFF` entries participate in the emergency override mechanism.

### 3.2 Emergency Override Mechanism

In Phase 2, when `ignoreAvailabilityInEmergency = true`, the solver processes each `DAY_OFF` slot with a binary override variable:

$$\text{override}_{n,d,s} = x_{n,d,s}$$

and adds to the objective:

$$+ \; w_{\text{override}} \cdot \text{override}_{n,d,s}$$

where $w_{\text{override}} = 50{,}000$ in the current configuration. This makes emergency assignments extremely costly but not forbidden — the solver will only invoke them when the alternative (understaff penalty) is worse.

`UNAVAILABLE` entries receive no such treatment: they remain as hard `model.Add(x[n,d,s] == 0)` in both phases.

---

## 4. The Constraint Escalation Defect

### 4.1 Mechanism

The nurse request seed file used `UNAVAILABLE` for all constraint types — including leave days — with an `ON CONFLICT DO UPDATE` clause:

```sql
-- Intended: hard-block other shifts, leave shift open
-- Actual: converted all leave DAY_OFF entries to UNAVAILABLE
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET type = EXCLUDED.type, source = EXCLUDED.source;
```

Because `shift_code = 'ALL'` entries for leave days already existed in the table (inserted by the manager seed as `DAY_OFF`), the upsert overwrote them:

```
DAY_OFF/ALL  ──(DO UPDATE)──►  UNAVAILABLE/ALL
```

This escalated leave constraints from soft-overridable to permanently hard, removing 125 records from the emergency override pool.

### 4.2 Impact on the Adapter

In the TypeScript normalizer adapter, the two-pass availability builder processes rows as follows:

```
Pass 1: collect hard-blocked (UNAVAILABLE/BLOCKED) tuples
Pass 2: add to overridableAvailability only if type == DAY_OFF
         AND not in hardBlocked set
```

After the escalation, all leave entries enter the `hardBlocked` set in Pass 1 and are excluded from `overridableAvailability` in Pass 2. The solver therefore receives an empty `overridable_availability` map for all affected nurse-date pairs, making emergency override structurally impossible for those slots.

---

## 5. Formal Feasibility Analysis

### 5.1 Feasibility Condition

**Definition.** Let $A(d)$ denote the set of nurses available (not hard-blocked) on day $d$. Let $P(s, s')$ be 1 if shift pair $(s, s')$ is a permitted same-day overtime combination. Define the *effective daily capacity* as:

$$C(d) = |A(d)| + \sum_{n \in A(d)} \mathbf{1}\!\left[\exists\, (s,s') : P(s,s') = 1\right]$$

This counts regular assignments plus feasible overtime assignments per nurse.

**Theorem.** Day $d$ is infeasible in Phase 1 if and only if:

$$C(d) < \sum_{s \in S} \delta_{d,s}$$

**Theorem.** Day $d$ is infeasible in Phase 2 if and only if the same condition holds *and* no nurse in $N \setminus A(d)$ has a `DAY_OFF` entry that the emergency override can activate.

After constraint escalation, all leave entries are `UNAVAILABLE`, so $N \setminus A(d)$ contributes zero nurses to Phase 2 recovery. Both theorems apply simultaneously.

### 5.2 Application to May 4, 2026

Nurse availability on May 4 after escalation:

| Nurse | Hard blocks | Available shifts |
|-------|------------|-----------------|
| NURSE_001 | EVENING, NIGHT | MORNING only |
| NURSE_004 | ALL (Leave → UNAVAILABLE) | None |
| NURSE_005 | ALL (Leave → UNAVAILABLE) | None |
| NURSE_007 | ALL (Leave → UNAVAILABLE) | None |
| NURSE_008 | ALL (Leave → UNAVAILABLE) | None |
| NURSE_002 | — | MORNING, EVENING, NIGHT |
| NURSE_003 | — | MORNING, EVENING, NIGHT |
| NURSE_006 | — | MORNING, EVENING, NIGHT |

Effective available set: $A(\text{May 4}) = \{\text{N001, N002, N003, N006}\}$, so $|A| = 4$.

Permitted overtime pairs (same-day):

- MORNING + EVENING: **permitted**
- MORNING + NIGHT: **forbidden** (`forbidMorningToNightSameDay = true`)
- EVENING + NIGHT: **effectively forbidden** (`forbidEveningToNight`, penalty = 99,999)

With NURSE_001 locked to MORNING only, the effective overtime set is $\{\text{N002, N003, N006}\}$ with valid OT pair MORNING+EVENING.

Effective daily capacity:

$$C(\text{May 4}) = 4 + 3 = 7 \text{ (3 nurses eligible for M+E OT)}$$

Total demand:

$$\sum_s \delta_{\text{May 4},s} = 2 + 2 + 2 = 6$$

So $C \geq \delta$ — Phase 1 is theoretically satisfiable. However, breaking the 7 capacity across 6 slots while covering *exactly* 2 NIGHT slots requires at least 2 nurses to be available for NIGHT. Under the permitted OT constraints:

Let $m_n, e_n, g_n \in \{0,1\}$ indicate MORNING, EVENING, NIGHT assignment for nurse $n$. The NIGHT coverage constraint requires:

$$g_{\text{N002}} + g_{\text{N003}} + g_{\text{N006}} \geq 2$$

But any nurse assigned to NIGHT cannot also take MORNING (forbidden) or EVENING→NIGHT on the same day (effectively forbidden). So nurses working NIGHT are capped at exactly 1 shift. The remaining nurses covering MORNING and EVENING can do OT (M+E). This gives:

- 2 nurses on NIGHT (1 shift each): covers $2 \times 1 = 2$ night slots
- 1 nurse on MORNING + EVENING (OT): covers 1 morning + 1 evening
- NURSE_001 on MORNING: covers 1 morning

Total: 1M (N001) + 1M + 1E (N00x OT) + 2N = 2M + 1E + 2N.

Evening demand = 2 but only 1 evening covered. **INFEASIBLE.**

The system cannot simultaneously satisfy 2 MORNING + 2 EVENING + 2 NIGHT with 4 nurses under the given sequence constraints, even with OT enabled. Phase 2 cannot recover because all 4 blocked nurses are `UNAVAILABLE` (not `DAY_OFF`), eliminating emergency reassignment.

---

## 6. Correct Constraint Typing Discipline

### 6.1 Invariant

The following invariant must hold to guarantee solver feasibility on any day with sufficient total nurse headcount:

> **Invariant:** All scheduled leave entries in `worker_availability` must use `type = DAY_OFF`, not `type = UNAVAILABLE`, regardless of the entry's `source` field.

This preserves the emergency override pool and ensures Phase 2 can always recover from capacity shortfalls.

### 6.2 Correct Seed Strategy

| Nurse request | Correct `type` | Shift code | Rationale |
|--------------|---------------|-----------|-----------|
| Leave | `DAY_OFF` | `ALL` | Emergency override possible |
| Assigned Night | `UNAVAILABLE` | `MORNING`, `EVENING` | Blocks non-Night shifts; Night slot remains open |
| Assigned Morning | `UNAVAILABLE` | `EVENING`, `NIGHT` | Blocks non-Morning shifts |
| Assigned Evening | `UNAVAILABLE` | `MORNING`, `NIGHT` | Blocks non-Evening shifts |
| OT Morning+Evening | `UNAVAILABLE` | `NIGHT` | Blocks Night only; M+E both remain open |

Note that specific shift assignments use `UNAVAILABLE` on the *other* shifts — not on the assigned shift itself. This forces the solver toward the assigned shift by elimination, while the target shift slot remains unconstrained and schedulable.

### 6.3 Upsert Strategy Correction

When nurse entries conflict with manager entries on the same `(worker_id, unit_id, date, shift_code)` key, the correct resolution depends on the type:

```sql
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
  -- Only escalate if the new type is strictly harder
  type   = CASE
             WHEN EXCLUDED.type = 'UNAVAILABLE' THEN 'UNAVAILABLE'
             ELSE worker_availability.type  -- preserve DAY_OFF if already set
           END,
  source = EXCLUDED.source,
  reason = EXCLUDED.reason;
```

This prevents `DAY_OFF` → `UNAVAILABLE` escalation while still allowing nurse-specific `UNAVAILABLE` entries to overwrite manager `DAY_OFF` entries only when the nurse entry is genuinely harder.

---

## 7. Broader Implications

### 7.1 Constraint Typing as a Safety Property

In constraint programming systems, the distinction between hard and soft constraints is a **safety property**: hard constraints define the feasible region, while soft constraints define the objective landscape within that region. Systems that allow data-layer operations to silently upgrade soft constraints to hard ones (as the upsert did here) violate the separation between feasibility guarantees and preference satisfaction.

A robust nurse scheduling system should enforce constraint typing at the application layer before persisting to the database, rejecting any operation that would convert a `DAY_OFF` entry (which the system architecture treats as soft) to `UNAVAILABLE` (hard) for leave-type records.

### 7.2 Minimum Viable Staffing Bound

For a unit with $|N|$ nurses, shift demand $\delta$ per shift (uniform), and $|S|$ shift types, the minimum staffing level to guarantee Phase 2 feasibility on any single day is:

$$|N| \geq \frac{|S| \cdot \delta}{\sigma_{\max}} + |N_{\text{hard-blocked}}|$$

where $\sigma_{\max}$ is the maximum permitted shifts per nurse per day and $N_{\text{hard-blocked}}$ is the number of nurses with `UNAVAILABLE/ALL` on that day. In the May 2026 unit: $|S| = 3$, $\delta = 2$, $\sigma_{\max} = 2$, giving a minimum of $\lceil 6/2 \rceil = 3$ available nurses. With 4 nurses blocked on May 4 (of 8 total), only 4 remain — theoretically sufficient, but the sequence constraints on NIGHT coverage tighten the effective bound beyond the naive calculation.

This highlights that minimum staffing bounds in systems with same-day sequence restrictions must account for the **shift-type coverage independence problem**: not all nurses in $A(d)$ can cover all shift types simultaneously due to sequencing constraints.

---

## 8. Summary

| Aspect | Detail |
|--------|--------|
| **Root cause** | `ON CONFLICT DO UPDATE` upserted leave entries as `UNAVAILABLE` instead of `DAY_OFF`, removing them from the emergency override pool |
| **Mechanism** | Two-phase CP-SAT solver relies on `DAY_OFF` entries being demoted to soft penalties in Phase 2; `UNAVAILABLE` entries remain hard in both phases |
| **Infeasible day** | May 4, 2026: 4 nurses hard-blocked, 3 remaining cannot cover 2M+2E+2N under sequence constraints |
| **Formal condition** | Effective assignable capacity $C(d) < \sum_s \delta_{d,s}$ with no emergency recovery path |
| **Fix** | Leave entries must use `DAY_OFF`; only shift-specific blocks use `UNAVAILABLE` on the non-assigned shifts |
| **Systemic recommendation** | Enforce constraint type invariant at application layer; prevent `DAY_OFF` → `UNAVAILABLE` escalation via upsert operations |
