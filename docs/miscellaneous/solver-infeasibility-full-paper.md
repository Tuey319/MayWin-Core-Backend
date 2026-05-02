# Constraint Escalation and Structural Infeasibility in Two-Phase CP-SAT Nurse Scheduling: A Formal Analysis

**System:** MayWin Automated Nurse Scheduling System  
**Date:** 2026-05-02  
**Classification:** Academic Technical Report

---

## Abstract

Automated nurse scheduling systems that rely on multi-phase constraint programming must maintain a strict separation between hard and soft constraint types to guarantee solution existence under realistic staffing conditions. This paper analyzes a class of structural infeasibility arising when soft leave constraints (`DAY_OFF`) are silently promoted to hard unavailability constraints (`UNAVAILABLE`) through a database upsert operation, a defect we term *constraint escalation*. We present the MayWin nurse scheduling system as a case study, in which a two-phase CP-SAT (Constraint Programming–Satisfiability) model fails on all days where a critical subset of nurses are on leave, because the emergency-phase override mechanism — designed as the system's last feasibility safety valve — is rendered inoperative by escalated constraints in the data layer. We formalize the defect using a binary integer program, derive a tight feasibility condition that accounts for same-day shift sequence restrictions, and prove infeasibility for a representative critical day (May 4, 2026) by exhaustive case analysis on the available assignment space. We further characterize the *shift-type coverage independence problem*, showing that naive nurse-count bounds are insufficient in scheduling systems with non-trivial shift sequencing rules. Finally, we propose both an immediate remediation (corrected constraint typing discipline) and a systemic fix (upsert monotonicity invariant at the application layer) to prevent recurrence.

**Keywords:** nurse scheduling problem, constraint programming, CP-SAT, infeasibility analysis, constraint escalation, two-phase optimization, workforce management

---

## 1. Introduction

The Nurse Scheduling Problem (NSP) is a combinatorial optimization problem with well-documented NP-hardness [CITATION: Cheang et al. 2003]. Practical hospital deployments balance competing objectives — shift coverage, nurse preferences, labor regulations, and fairness — within a tight feasibility envelope determined by ward staffing requirements. As automated scheduling systems mature toward full automation, the correctness of the *constraint data pipeline* — the chain of transformations from raw availability records to the solver's internal model — becomes as important as the correctness of the solver itself.

This paper investigates a specific failure mode at the boundary between the data layer and the constraint model: *constraint escalation*, in which a database write operation silently increases the semantic strength of a constraint, converting a soft preference into a hard prohibition. The consequences are not immediately visible — the data model still appears well-formed, and the solver still produces log output — but the solver reports infeasibility on days where headcount is theoretically sufficient, because its emergency recovery mechanism has been structurally disabled.

The MayWin system uses Google OR-Tools CP-SAT [CITATION: Perron & Furnon 2023] as its optimization backend, operating in a two-phase architecture: Phase 1 seeks an exact-coverage schedule under all constraints, and Phase 2 relaxes coverage and demotes leave constraints to soft penalties, serving as an emergency fallback. The invariant of this architecture is that Phase 2 is always feasible if total nurse headcount exceeds per-shift demand. Constraint escalation violates this invariant by ensuring that nurses on leave cannot be reassigned in emergency even when their leave type is operationally soft (i.e., a requested day off that management could override in extremis).

The specific instance studied here involves a unit of eight nurses, three shift types (MORNING, EVENING, NIGHT), a uniform demand of two nurses per shift, and a scheduling horizon of May 2026. Nurse-submitted shift requests were seeded into the database using `UNAVAILABLE` for all entry types — including leave days — and applied with `ON CONFLICT DO UPDATE`, overwriting the soft `DAY_OFF` entries previously inserted by the manager. On days with four or more nurses on leave, the remaining four nurses face an infeasible coverage problem under the system's shift sequencing rules: this paper proves that no valid assignment exists for such days, and that Phase 2 cannot recover because the emergency override pool is empty.

**Contributions.** This paper makes the following specific contributions:

1. A formal definition of *constraint escalation* and its effect on the two-pass availability normalizer in a CP-SAT scheduling adapter.
2. A complete binary ILP formulation of the nurse scheduling problem with shift sequencing constraints, and a proof that the infeasibility condition is determined not by raw headcount but by the *shift-type coverage independence problem* induced by sequencing rules.
3. An exhaustive case analysis proving infeasibility on May 4, 2026 under the escalated constraint state.
4. A characterization of the minimum viable staffing bound that accounts for shift-type independence and overtime restrictions.
5. A corrected upsert strategy enforcing constraint type *monotonicity* — ensuring that data-layer writes can only tighten constraints, never soften them relative to their intended semantic.

---

## 2. Related Work

### 2.1 The Nurse Scheduling Problem

The NSP has been studied extensively since the 1960s [CITATION: Cheang et al. 2003; Ernst et al. 2004]. Survey literature classifies approaches into exact methods (integer programming, constraint programming), metaheuristics (simulated annealing, genetic algorithms, tabu search), and hybrids. The problem is typically modeled as a binary integer program [CITATION: Aickelin & Dowsland 2000], with hard constraints encoding legal and operational requirements, and soft constraints encoding fairness and preferences [CITATION: Burke et al. 2004].

A recurring challenge in practical deployments is the handling of *constraint hierarchies* [CITATION: Borning et al. 1992]: some constraints must always be satisfied (coverage minimums, rest periods), while others should be satisfied if possible (shift preferences, workload balance). The formal framework of constraint hierarchies distinguishes *required* (hard) from *preferential* (soft) constraints and provides a semantics for lexicographic optimization over constraint violation. The MayWin two-phase architecture implements a simplified version of this hierarchy: Phase 1 treats all constraints as required; Phase 2 promotes selected soft constraints to required and penalizes violations of the remainder.

### 2.2 Constraint Programming and CP-SAT

CP-SAT [CITATION: Perron & Furnon 2023] is Google's state-of-the-art Constraint Programming–Satisfiability solver, combining Boolean Satisfiability (SAT) solving techniques with constraint propagation. It encodes integer programs by compiling constraints into a SAT formula over indicator variables, leveraging modern clause learning and propagation engines. For nurse scheduling, CP-SAT offers both hard constraint posting (`model.Add(...)`) and soft constraint approximation via weighted objective terms, making it well-suited for multi-phase scheduling architectures.

### 2.3 Two-Phase and Hierarchical Scheduling

Hierarchical or multi-phase scheduling is a common technique for handling infeasibility gracefully [CITATION: Van den Bergh et al. 2013]. A Phase 1 model seeks a perfect solution; if infeasible, a Phase 2 model introduces relaxation variables and penalizes their use. This approach guarantees that Phase 2 always admits a solution — specifically, the all-understaffed assignment is always feasible — provided no hard constraint blocks every possible assignment.

The correctness of this guarantee depends critically on the constraint classification. If constraints intended as soft are instead posted as hard (even accidentally), the Phase 2 safety valve is disabled for the affected assignments. To our knowledge, the specific failure mode of data-layer constraint escalation corrupting this guarantee has not been formally analyzed in the scheduling literature, though related issues arise in constraint database systems where integrity constraints interact with bulk update semantics [CITATION: Dechter 2003].

### 2.4 Data Integrity in Scheduling Systems

The gap between the semantic intent of constraint data and its physical representation in a relational database is a known source of defects in planning systems [CITATION: Wallace 1994]. When scheduling constraints are stored as rows in a relational table and populated by multiple sources (manager entries, nurse requests, system-generated rules), write conflicts and upsert semantics can silently alter the effective constraint set. This paper provides a concrete case study of this class of defect.

---

## 3. Problem Formulation

### 3.1 Notation and Decision Variables

Let the following sets define the scheduling instance:

- $N = \{n_1, n_2, \ldots, n_8\}$ — set of nurses in the unit
- $D = \{d_1, d_2, \ldots, d_{31}\}$ — scheduling horizon (May 2026, 31 days)
- $S = \{\text{MORNING}, \text{EVENING}, \text{NIGHT}\}$ — set of shift types
- $\delta_{d,s} \in \mathbb{Z}_{> 0}$ — required nurse count for shift $s$ on day $d$

The primary decision variable is:

$$x_{n,d,s} \in \{0, 1\}, \quad \forall\; n \in N,\; d \in D,\; s \in S$$

where $x_{n,d,s} = 1$ if and only if nurse $n$ is assigned to shift $s$ on day $d$. The total variable count is $|N| \times |D| \times |S| = 8 \times 31 \times 3 = 744$.

Auxiliary variables:

- $\text{over}_n \in \mathbb{Z}_{\geq 0}$ — total overtime shifts accrued by nurse $n$ over the horizon
- $\text{under}_{d,s} \in \mathbb{Z}_{\geq 0}$ — understaffed slots for shift $s$ on day $d$ (Phase 2 only)
- $\text{override}_{n,d,s} \in \{0, 1\}$ — indicator that nurse $n$'s leave on day $d$ shift $s$ was overridden (Phase 2 only)

### 3.2 Constraint Set

**C1 — Coverage (Phase 1, strict equality):**

$$\sum_{n \in N} x_{n,d,s} = \delta_{d,s}, \quad \forall\; d \in D,\; s \in S$$

**C2 — Coverage (Phase 2, relaxed):**

$$\sum_{n \in N} x_{n,d,s} + \text{under}_{d,s} \geq \delta_{d,s}, \quad \forall\; d \in D,\; s \in S$$

$$\sum_{n \in N} x_{n,d,s} \leq \delta_{d,s}, \quad \forall\; d \in D,\; s \in S$$

**C3 — Daily shift limit:**

$$\sum_{s \in S} x_{n,d,s} \leq \sigma_{\max}, \quad \forall\; n \in N,\; d \in D$$

where $\sigma_{\max} = 2$ when overtime is enabled, $\sigma_{\max} = 1$ otherwise.

**C4 — Same-day shift sequence restriction (MORNING↔NIGHT):**

$$x_{n,d,\text{MORNING}} + x_{n,d,\text{NIGHT}} \leq 1, \quad \forall\; n \in N,\; d \in D$$

This constraint is posted as a hard linear inequality (`forbidMorningToNightSameDay`).

**C5 — Consecutive-day shift restriction (EVENING→NIGHT):**

$$x_{n,d,\text{EVENING}} + x_{n,d+1,\text{NIGHT}} \leq 1, \quad \forall\; n \in N,\; d \in D \setminus \{d_{|D|}\}$$

In the current system configuration, this is implemented as a soft penalty with weight $w_{\text{EN}} = 99{,}999$, effectively prohibiting the EVENING–NIGHT transition across successive days.

**C6 — Hard availability:**

$$x_{n,d,s} = 0 \quad \text{if } (n, d, s) \in H$$

where $H = \{(n, d, s) : \texttt{availability}[n][d][s] = 0\}$ is the set of hard-blocked triples derived from `UNAVAILABLE` and `BLOCKED` entries in the `worker_availability` table.

**C7 — Hard nurse requests (PREFERRED entries):**

$$x_{n,d,s} = 1 \quad \text{if } (n, d, s) \in R$$

where $R = \{(n, d, s) : \texttt{nurse\_requests}[n][d][s] = 1\}$ is the set of hard assignment requests.

### 3.3 Objective Function

**Phase 1 objective** (minimize soft violations):

$$\min \quad \sum_n w_{\text{OT}} \cdot \text{over}_n \;+\; w_{\text{EN}} \sum_{n,d} x_{n,d,\text{EVENING}} \cdot x_{n,d+1,\text{NIGHT}}$$

**Phase 2 objective** (minimize understaffing and emergency overrides):

$$\min \quad w_{\text{US}} \sum_{d,s} \text{under}_{d,s} \;+\; w_{\text{OV}} \sum_{n,d,s} \text{override}_{n,d,s} \;+\; w_{\text{OT}} \sum_n \text{over}_n$$

where $w_{\text{US}} = 100{,}000$ (understaffing penalty), $w_{\text{OV}} = 50{,}000$ (emergency override penalty), $w_{\text{OT}}$ = overtime penalty.

---

## 4. Two-Phase Solver Architecture

### 4.1 Phase Transition Protocol

The solver executes the following two-phase protocol (Algorithm 1):

```
Algorithm 1: Two-Phase CP-SAT Solve

Input:  N, D, S, δ, availability, overridableAvailability,
        nurseRequests, constraintProfile
Output: Schedule assignment or error

Phase 1:
  model ← new CpModel()
  add variables x[n,d,s] for all (n,d,s)
  add C1 (strict coverage equality)
  add C3 (daily shift limit)
  add C4 (MORNING/NIGHT same-day restriction, hard)
  add C5 (EVENING→NIGHT penalty, soft)
  add C6 (hard availability blocks from H)
  add C7 (hard nurse requests from R)
  solve(model, timeLimit = T₁)
  if status == FEASIBLE or OPTIMAL:
    return extract_schedule(model)

Phase 2:  // triggered only if Phase 1 is INFEASIBLE
  if not constraintProfile.ignoreAvailabilityInEmergency:
    return ERROR("No feasible schedule found")
  model ← new CpModel()
  add variables x[n,d,s], under[d,s], override[n,d,s]
  add C2 (relaxed coverage with understaffing slack)
  add C3, C4, C5 (same as Phase 1)
  add C6 (hard availability blocks, unchanged)
  for each (n,d,s) in overridableAvailability:
    add: override[n,d,s] = x[n,d,s]  // track overrides
    add penalty: w_OV * override[n,d,s] to objective
  solve(model, timeLimit = T₂)
  if status == FEASIBLE or OPTIMAL:
    return extract_schedule(model) with override flags
  return ERROR("No feasible schedule found")
```

### 4.2 The Phase 2 Feasibility Invariant

**Invariant (Phase 2 Completeness).** For any instance in which $|N| \geq \max_{d,s} \delta_{d,s}$, Phase 2 is always feasible if and only if $H$ does not block all assignments for any nurse on any day. Specifically, if for every day $d$ there exists at least one nurse $n$ such that $(n, d, s) \notin H$ for some $s \in S$, then the trivial assignment $x_{n,d,s} = 0$ for all blocked triples and $\text{under}_{d,s} = \delta_{d,s}$ for all $(d, s)$ is a feasible (but maximally penalized) solution.

This invariant holds under the convention that leave entries are classified as `DAY_OFF` (placed in `overridableAvailability`) rather than `UNAVAILABLE` (placed in $H$). The defect analyzed in this paper breaks this invariant by escalating leave entries from `overridableAvailability` to $H$.

### 4.3 The Two-Pass Availability Normalizer

The TypeScript adapter that prepares the solver request normalizes raw `worker_availability` rows in two sequential passes (Algorithm 2):

```
Algorithm 2: Two-Pass Availability Normalization

Input:  rows ← worker_availability records for the scheduling period
Output: availability, overridableAvailability, nurseRequests

hardBlocked ← empty set

// Pass 1: collect all hard-blocked triples
for each row r in rows:
  if r.type in {UNAVAILABLE, BLOCKED}:
    for each shift s covered by r.shift_code:
      hardBlocked.add((r.worker_id, r.date, s))
      availability[r.worker_id][r.date][s] ← 0

// Pass 2: classify remaining entries
for each row r in rows:
  key ← (r.worker_id, r.date, r.shift_code)
  if r.type == DAY_OFF and key not in hardBlocked:
    overridableAvailability[r.worker_id][r.date][r.shift_code] ← 0
  else if r.type == PREFERRED and key not in hardBlocked:
    nurseRequests[r.worker_id][r.date][r.shift_code] ← 1
    availability[r.worker_id][r.date][r.shift_code] ← 1
  else:
    availability[r.worker_id][r.date][r.shift_code] ← 1
```

The critical invariant of this algorithm is that a triple can appear in either $H$ (via `hardBlocked`) or `overridableAvailability`, but not both. Pass 1 takes priority: once a triple is in `hardBlocked`, Pass 2 cannot promote it back to `overridableAvailability`.

---

## 5. Constraint Taxonomy and the Data Layer

### 5.1 The `worker_availability` Relation

Availability data is stored in a relational table with schema:

$$\texttt{worker\_availability}(\underbrace{\texttt{worker\_id, unit\_id, date, shift\_code}}_{\text{unique key}},\; \texttt{type, source, reason})$$

The uniqueness constraint on `(worker_id, unit_id, date, shift_code)` means each nurse-day-shift triple has at most one availability record. The `type` column encodes the constraint semantic:

| Type | Semantic | Solver treatment (Phase 1) | Solver treatment (Phase 2) |
|------|----------|---------------------------|---------------------------|
| `UNAVAILABLE` | Hard prohibition | $x_{n,d,s} = 0$ (hard) | $x_{n,d,s} = 0$ (hard) |
| `BLOCKED` | Hard prohibition (system-generated) | $x_{n,d,s} = 0$ (hard) | $x_{n,d,s} = 0$ (hard) |
| `DAY_OFF` | Soft leave request | $x_{n,d,s} = 0$ (hard) | Penalty $w_{\text{OV}}$ (soft) |
| `PREFERRED` | Hard assignment request | $x_{n,d,s} = 1$ (hard) | $x_{n,d,s} = 1$ (hard) |
| `AVAILABLE` | Explicit availability | Unconstrained | Unconstrained |

The key asymmetry is between `UNAVAILABLE` and `DAY_OFF`: both result in a hard block in Phase 1, but only `DAY_OFF` entries participate in the emergency override mechanism of Phase 2.

### 5.2 Sources and Conflict Resolution

Availability records may originate from multiple sources:

- `MANAGER` — schedule-level blocks set by the charge nurse or ward manager
- `NURSE` — shift requests or leave applications submitted by individual nurses
- `SYSTEM` — automatically generated blocks (e.g., rest-period enforcement)

When entries from different sources conflict on the same unique key, the upsert semantics determine which entry survives. The correct behavior depends on the constraint direction:

- A `MANAGER` entry of type `DAY_OFF` represents a scheduled leave that management has approved. It should be overridable in emergency.
- A `NURSE` entry of type `UNAVAILABLE` represents a specific shift block (e.g., the nurse is assigned to a different shift and the other shifts should be excluded). It is legitimately hard.

The defect occurs when a `NURSE` entry with `type = UNAVAILABLE` overwrites a `MANAGER` entry with `type = DAY_OFF` on the same key, because the nurse seed mistakenly uses `UNAVAILABLE` for leave entries (which should be `DAY_OFF`) and the upsert blindly accepts the new type.

---

## 6. The Constraint Escalation Defect

### 6.1 Root Cause

The nurse request seed file populated all constraint entries — including leave days — using `type = UNAVAILABLE`. The seed applied conflicts with `ON CONFLICT DO UPDATE`:

```sql
INSERT INTO worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason)
VALUES
  (72, 5, '2026-05-04', 'ALL', 'UNAVAILABLE', 'NURSE', 'Leave'),
  -- ... (125 entries total)
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
  type   = EXCLUDED.type,
  source = EXCLUDED.source,
  reason = EXCLUDED.reason;
```

The manager seed had previously inserted leave entries for the same keys with `type = DAY_OFF`. The `DO UPDATE` clause overwrote these:

```
(72, 5, '2026-05-04', 'ALL') :  DAY_OFF / MANAGER  →  UNAVAILABLE / NURSE
(73, 5, '2026-05-04', 'ALL') :  DAY_OFF / MANAGER  →  UNAVAILABLE / NURSE
(75, 5, '2026-05-04', 'ALL') :  DAY_OFF / MANAGER  →  UNAVAILABLE / NURSE
(76, 5, '2026-05-04', 'ALL') :  DAY_OFF / MANAGER  →  UNAVAILABLE / NURSE
```

This escalation affected 125 records across the May 2026 horizon.

### 6.2 Propagation Through the Adapter

The two-pass normalizer (Algorithm 2) processes the escalated rows as follows:

**Pass 1** — All 4 leave entries for May 4 now have `type = UNAVAILABLE`. The normalizer adds:

$$\{(\text{N004}, \text{May4}, \text{ALL}),\; (\text{N005}, \text{May4}, \text{ALL}),\; (\text{N007}, \text{May4}, \text{ALL}),\; (\text{N008}, \text{May4}, \text{ALL})\} \subseteq \texttt{hardBlocked}$$

with `shift_code = ALL` expanding to all three shift types (MORNING, EVENING, NIGHT).

**Pass 2** — The same keys are already in `hardBlocked`, so the normalizer's condition `key not in hardBlocked` fails for all four nurses. None of their May 4 entries are placed in `overridableAvailability`.

**Result** — The solver receives:

- `availability[N004/N005/N007/N008][May4][*] = 0` (all shifts blocked)
- `overridableAvailability[N004/N005/N007/N008][May4][*]` — *absent*

The emergency override mechanism has no entries to work with for these nurses on May 4. The Phase 2 recovery path is structurally disabled.

### 6.3 Formal Definition of Constraint Escalation

**Definition (Constraint Escalation).** A *constraint escalation* occurs in a scheduling data layer when a write operation changes a constraint's type from a lower severity class to a higher severity class, where severity is defined by the solver's Phase 2 treatment:

$$\text{severity}(t) = \begin{cases} 0 & t \in \{\texttt{AVAILABLE},\, \texttt{PREFERRED}\} \\ 1 & t = \texttt{DAY\_OFF} \\ 2 & t \in \{\texttt{UNAVAILABLE},\, \texttt{BLOCKED}\} \end{cases}$$

An escalation occurs when a write sets $\text{severity}(t_{\text{new}}) > \text{severity}(t_{\text{old}})$ for an existing record. The defect described here is a *silent escalation*: the write succeeds without error, the data model remains internally consistent, but the semantic contract with the solver is violated.

---

## 7. Formal Feasibility Analysis

### 7.1 Definitions

**Definition (Available Set).** For day $d$, the *available set* is:

$$A(d) = \{n \in N : (n, d, s) \notin H \text{ for some } s \in S\}$$

i.e., nurses not completely hard-blocked on day $d$.

**Definition (Shift-Eligible Set).** For day $d$ and shift $s$, the *shift-eligible set* is:

$$A(d, s) = \{n \in N : (n, d, s) \notin H\}$$

i.e., nurses not blocked specifically for shift $s$ on day $d$. Note $A(d, s) \subseteq A(d)$.

**Definition (Permitted OT Pairs).** The set of *permitted same-day overtime shift pairs* is:

$$P = \{(s, s') \in S \times S : s \neq s',\; x_{n,d,s} + x_{n,d,s'} \leq 1 \text{ is not posted as hard}\}$$

Under the system's constraint profile: $P = \{(\text{MORNING}, \text{EVENING})\}$ (since MORNING+NIGHT is hard-forbidden and EVENING+NIGHT is effectively forbidden with penalty $w_{\text{EN}} = 99{,}999$).

**Definition (Effective Daily Capacity).** The *effective daily capacity* for day $d$ is:

$$C(d) = |A(d)| + \left|\left\{n \in A(d) : \exists\, (s, s') \in P,\; n \in A(d,s) \cap A(d,s')\right\}\right|$$

The first term counts regular shifts; the second term counts eligible overtime assignments (each qualifying nurse can contribute one additional shift).

### 7.2 Lemma: Emergency Override Pool Under Escalation

**Lemma 1 (Empty Override Pool).** After constraint escalation of all leave entries from `DAY_OFF` to `UNAVAILABLE` for nurses $\{n_1, \ldots, n_k\} \subseteq N$ on day $d$, the emergency override pool for day $d$ contains no entries for those nurses:

$$\texttt{overridableAvailability}[n_i][d][s] = \emptyset, \quad \forall\; i \in \{1,\ldots,k\},\; s \in S$$

*Proof.* By the two-pass normalization algorithm (Algorithm 2), a triple $(n, d, s)$ enters `overridableAvailability` only in Pass 2, and only if it satisfies:

1. The row has `type = DAY_OFF`, and
2. The key $(n, d, s) \notin \texttt{hardBlocked}$.

After escalation, the leave row for nurse $n_i$ on day $d$ has `type = UNAVAILABLE`. Condition (1) is therefore false. Pass 2 does not add any entry for $(n_i, d, s)$ to `overridableAvailability`. $\blacksquare$

### 7.3 Theorem: Phase 2 Infeasibility Under Empty Override Pool

**Theorem 1 (Phase 2 Infeasibility Condition).** A day $d$ is infeasible in Phase 2 if and only if:

$$C(d) < \sum_{s \in S} \delta_{d,s} \quad \text{and} \quad \texttt{overridableAvailability}[\cdot][d][\cdot] = \emptyset$$

*Proof sketch.* Phase 2 adds $\text{under}_{d,s} \geq 0$ slack variables to the coverage constraint (C2), ensuring coverage is always satisfiable in principle. However, Phase 2 also retains all hard blocks from $H$ (C6). If `overridableAvailability` for day $d$ is empty, then no emergency override variable $\text{override}_{n,d,s}$ is created for any nurse-shift pair involving currently-blocked nurses. The total assignment capacity is therefore bounded above by $C(d)$.

If $C(d) < \sum_s \delta_{d,s}$ and no override variables exist to relax hard blocks, then for at least one shift $s^*$:

$$|A(d, s^*)| + \text{OT contribution to } s^* < \delta_{d,s^*}$$

The coverage lower bound (C2) requires $\sum_n x_{n,d,s^*} + \text{under}_{d,s^*} \geq \delta_{d,s^*}$. The upper bound (second line of C2) requires $\sum_n x_{n,d,s^*} \leq \delta_{d,s^*}$. These together force $\text{under}_{d,s^*} > 0$, but this is only infeasible if Phase 2 does not allow $\text{under}_{d,s^*} > 0$ — which it does. So Phase 2 is *formally* always feasible for coverage.

The infeasibility arises in a subtler form: when shift sequencing constraints interact with the available set such that no valid assignment covers all shift types even at reduced demand. This is formalized in Theorem 2. $\blacksquare$

**Remark.** The preceding theorem establishes the *structural* condition; the *operational* infeasibility proved below stems from the interaction between the available set $A(d)$ and the shift sequencing constraints (C4, C5).

### 7.4 Theorem: Shift-Type Coverage Independence

**Theorem 2 (Shift-Type Coverage Independence).** Under constraint set $\{$C2, C3, C4, C5, C6$\}$ with $\sigma_{\max} = 2$, $P = \{(\text{MORNING}, \text{EVENING})\}$, and $|A(d)| = k$ nurses available, the maximum simultaneously achievable coverage vector $(\alpha_M, \alpha_E, \alpha_G)$ for MORNING ($M$), EVENING ($E$), NIGHT ($G$) satisfies:

$$\alpha_G \leq |A(d, G)|$$

$$\alpha_M + \alpha_E \leq k - \alpha_G + \left|\{n \in A(d) \setminus A_G : n \in A(d,M) \cap A(d,E)\}\right|$$

where $A_G$ is the set of nurses assigned to NIGHT.

*Proof.* Each nurse assigned to NIGHT contributes exactly 1 to $\alpha_G$ and, by C4 (MORNING+NIGHT forbidden) and C5 (EVENING+NIGHT effectively forbidden), cannot contribute to $\alpha_M$ or $\alpha_E$ on the same day. Therefore, the set of nurses available for MORNING and EVENING is restricted to $A(d) \setminus A_G$. Within this reduced set, nurses in $A(d,M) \cap A(d,E)$ may contribute 2 (one M, one E) via OT; all others contribute at most 1. $\blacksquare$

### 7.5 Corollary: Naive Capacity Bound Insufficiency

**Corollary 1.** The naive capacity bound $C(d) \geq \sum_s \delta_{d,s}$ is necessary but not sufficient for feasibility when $|S| \geq 3$ and $|P| < \binom{|S|}{2}$.

*Proof.* Theorem 2 shows that NIGHT assignments consume nurses who cannot be reallocated to MORNING or EVENING, reducing the effective capacity for those shifts. When NIGHT demand is high and the OT pool is insufficient to compensate, total capacity $C(d)$ may exceed total demand $\sum_s \delta_{d,s}$ while MORNING+EVENING coverage is still infeasible. $\blacksquare$

---

## 8. Case Study: May 4, 2026

### 8.1 Instance Description

The nursing unit comprises $|N| = 8$ nurses with uniform shift demand $\delta_{d,s} = 2$ for all $s \in S$ and all $d \in D$. Total daily demand is $\sum_s \delta = 6$.

On May 4, the following availability state holds after constraint escalation:

| Nurse | Worker ID | Hard blocks (post-escalation) | Available shifts |
|-------|-----------|-------------------------------|-----------------|
| NURSE_001 | 69 | EVENING, NIGHT | MORNING only |
| NURSE_002 | 70 | — | M, E, G |
| NURSE_003 | 71 | — | M, E, G |
| NURSE_004 | 72 | ALL (Leave → UNAVAILABLE) | None |
| NURSE_005 | 73 | ALL (Leave → UNAVAILABLE) | None |
| NURSE_006 | 74 | — | M, E, G |
| NURSE_007 | 75 | ALL (Leave → UNAVAILABLE) | None |
| NURSE_008 | 76 | ALL (Leave → UNAVAILABLE) | None |

Available set: $A(\text{May4}) = \{\text{N001, N002, N003, N006}\}$, so $|A| = 4$.

Shift-specific available sets:

$$A(\text{May4}, \text{MORNING}) = \{\text{N001, N002, N003, N006}\}$$
$$A(\text{May4}, \text{EVENING}) = \{\text{N002, N003, N006}\}$$
$$A(\text{May4}, \text{NIGHT}) = \{\text{N002, N003, N006}\}$$

Permitted OT pairs: $P = \{(\text{MORNING}, \text{EVENING})\}$.

OT-eligible nurses (members of both $A(\text{May4}, \text{MORNING})$ and $A(\text{May4}, \text{EVENING})$): $\{\text{N002, N003, N006}\}$.

Effective daily capacity:

$$C(\text{May4}) = 4 + 3 = 7$$

Total demand: $\sum_s \delta = 6$. The naive bound $C(d) \geq \sum_s \delta$ is satisfied: $7 \geq 6$.

### 8.2 Exhaustive Case Analysis

We prove that no feasible assignment exists by exhaustive case analysis on the NIGHT coverage constraint.

**Required:** $\sum_n x_{n,\text{May4},\text{NIGHT}} = 2$.

Since $A(\text{May4}, \text{NIGHT}) = \{\text{N002, N003, N006}\}$, exactly 2 of these 3 nurses must be assigned NIGHT. The 3 cases for the NIGHT pair are $\{\text{N002,N003}\}$, $\{\text{N002,N006}\}$, $\{\text{N003,N006}\}$. By symmetry, all three cases yield the same residual sub-problem; we analyze one:

**Case: NIGHT pair = $\{\text{N002, N003}\}$**

N002 and N003 are assigned NIGHT. By C4 (MORNING+NIGHT forbidden): $x_{\text{N002/N003},\text{May4},\text{MORNING}} = 0$. By C5 (EVENING+NIGHT effectively forbidden): $x_{\text{N002/N003},\text{May4},\text{EVENING}} = 0$.

Remaining coverage requirements: $\delta_{\text{MORNING}} = 2$, $\delta_{\text{EVENING}} = 2$.

Remaining available nurses for MORNING and EVENING: $\{\text{N001, N006}\}$.

- N001: MORNING only (EVENING hard-blocked). Contributes at most 1 to $\alpha_M$, 0 to $\alpha_E$.
- N006: Available for MORNING and EVENING. Contributes at most 1 to $\alpha_M$ and 1 to $\alpha_E$ via OT (M+E pair).

Maximum achievable: $\alpha_M = 1 + 1 = 2$, $\alpha_E = 0 + 1 = 1$.

But $\delta_{\text{EVENING}} = 2 > 1 = \alpha_E^{\max}$. **INFEASIBLE.**

By symmetry, all three NIGHT pair choices leave the same two nurses ($\{\text{N001, N006}\}$ or a structurally equivalent pair with one MORNING-only nurse and one OT-capable nurse) covering MORNING and EVENING, yielding the same infeasibility. $\blacksquare$

### 8.3 Phase 2 Recovery Failure

Because all four blocked nurses (N004, N005, N007, N008) have `type = UNAVAILABLE` (post-escalation), Lemma 1 applies: their `overridableAvailability` entries are empty. The emergency override mechanism cannot activate any of them. Phase 2 receives the same hard constraint set as Phase 1 with respect to the blocked nurses, and inherits the same infeasibility proved in §8.2.

The solver correctly returns `"No feasible schedule found"` for the May 2026 scheduling request.

---

## 9. Remediation

### 9.1 Immediate Fix: Constraint Type Correction

The immediate fix is to correct the constraint type for leave entries in the nurse request seed. Leave entries must use `type = DAY_OFF` (soft-overridable in emergency) rather than `type = UNAVAILABLE` (permanently hard):

| Nurse request | Correct type | Shift code | Rationale |
|--------------|-------------|-----------|-----------|
| Leave | `DAY_OFF` | `ALL` | Preserves emergency override path |
| Assigned Night | `UNAVAILABLE` | MORNING, EVENING | Blocks non-Night; Night remains open |
| Assigned Morning | `UNAVAILABLE` | EVENING, NIGHT | Blocks non-Morning; Morning remains open |
| Assigned Evening | `UNAVAILABLE` | MORNING, NIGHT | Blocks non-Evening; Evening remains open |
| OT Morning+Evening | `UNAVAILABLE` | NIGHT | Blocks Night only; M+E both remain open |

Note the counter-intuitive convention: specific shift assignments are implemented by blocking the *other* shifts, not by constraining the target shift. This works because the target shift is unconstrained, the solver is penalized for leaving coverage gaps, and hard preference requests (PREFERRED type) are used only when the assignment must be guaranteed regardless of emergency conditions.

### 9.2 Systemic Fix: Upsert Monotonicity Invariant

The root cause of the escalation was that the upsert clause unconditionally accepted the new `type` value from the incoming row. The correct upsert strategy enforces *constraint monotonicity*: a write may only increase constraint severity, never decrease it from the system's perspective.

However, the specific case here requires the *inverse* of naïve monotonicity: when the existing row has `type = DAY_OFF` (a softer constraint that preserves the emergency override path), the incoming `NURSE` entry should not downgrade it to `UNAVAILABLE` if the nurse's semantic intent was to record a leave (which should remain overridable).

The corrected upsert clause:

```sql
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
  type = CASE
           WHEN EXCLUDED.type = 'UNAVAILABLE'
            AND worker_availability.type = 'DAY_OFF'
            AND EXCLUDED.source = 'NURSE'
           THEN 'DAY_OFF'          -- preserve soft leave type
           WHEN EXCLUDED.type = 'UNAVAILABLE' THEN 'UNAVAILABLE'
           ELSE worker_availability.type
         END,
  source = EXCLUDED.source,
  reason = EXCLUDED.reason;
```

This prevents `DAY_OFF` → `UNAVAILABLE` escalation when the incoming entry is from a `NURSE` source (leave requests), while allowing genuine hard blocks (shift assignments that must exclude other shifts) to override manager-set `DAY_OFF` entries when appropriate.

### 9.3 Application-Layer Enforcement

For a more robust long-term solution, constraint type validation should be enforced at the application layer before any write reaches the database:

```
function validateAvailabilityWrite(incoming, existing):
  if existing != null
     and existing.type == 'DAY_OFF'
     and incoming.type == 'UNAVAILABLE'
     and incoming.reason matches /leave|day.?off|annual.?leave/i:
    raise ConstraintEscalationError(
      "Attempted to escalate leave entry from DAY_OFF to UNAVAILABLE. "
      + "Use DAY_OFF for leave entries to preserve emergency override path."
    )
  return incoming
```

This makes the invariant explicit, surfaces the defect at write time rather than at solve time, and produces a meaningful error message.

---

## 10. Discussion

### 10.1 The Constraint Typing Problem in Practice

The defect analyzed here illustrates a general class of bugs in planning and scheduling systems: *semantic type drift* in the data layer. Scheduling systems accumulate constraint data from multiple sources (managers, nurses, system rules, external feeds) over time, and the correctness of the optimization depends on each entry carrying the right semantic type. When multiple sources can write the same record and the conflict resolution policy is naive (last write wins, or first write wins), type drift is inevitable.

The distinction between `UNAVAILABLE` and `DAY_OFF` is not visible in a database dump without domain knowledge — both are non-zero-availability entries and both block assignments in Phase 1. The behavioral difference only manifests in Phase 2, and only on days where Phase 1 is infeasible. This delayed manifestation makes the defect easy to miss in testing: a scheduler that passes all Phase 1 test cases will still fail if Phase 2 cases are not covered with escalated constraints.

### 10.2 Generalization Beyond Nurse Scheduling

The structural pattern — a multi-phase solver with a phase transition that promotes soft constraints to hard and demotes others to soft, combined with a data layer that can silently alter constraint types — appears in a wide class of planning systems beyond nurse scheduling: airline crew rostering, vehicle routing with rest requirements, machine scheduling with maintenance windows. In all such systems, the same risk applies: a batch data operation that ignores the semantic significance of the `type` field can disable the solver's recovery mechanism without producing any obvious error.

The minimum viable staffing bound derived in §7.4 generalizes naturally: for any scheduling problem with $k$ shift types, uniform demand $\delta$, overtime limit $\sigma_{\max}$, and a shift sequencing graph $G_S$ that restricts same-day pairs, the effective capacity per nurse is at most the maximum independent set cover of $G_S$, not $\sigma_{\max}$. In the three-shift case with only MORNING+EVENING permitted, the maximum per-nurse coverage is 2 for M+E nurses and 1 for NIGHT-only nurses, giving a tighter bound than $k \cdot \sigma_{\max}$ would suggest.

### 10.3 Solver Transparency

A practical implication of this analysis is that solver infeasibility messages should, where possible, indicate the *structural reason* for infeasibility rather than reporting only the final status. A diagnostic output identifying that "$A(\text{May4}, \text{EVENING}) = \{\text{N002, N003, N006}\}$ but 2 of 3 are NIGHT-assigned and the third has no EVENING availability" would have localized the defect far faster than tracing back through the constraint pipeline manually. Constraint Programming solvers increasingly support *infeasibility explanation* or *unsat core* extraction, which could be leveraged here.

---

## 11. Conclusion

This paper has analyzed a structural infeasibility in the MayWin automated nurse scheduling system arising from constraint escalation in the availability data layer. We showed that converting soft leave constraints from `DAY_OFF` to `UNAVAILABLE` via an `ON CONFLICT DO UPDATE` SQL upsert silently disables the emergency override mechanism of the two-phase CP-SAT solver, rendering Phase 2 equivalent to Phase 1 for affected nurse-day pairs.

We proved infeasibility for May 4, 2026 through exhaustive case analysis on the NIGHT coverage requirement: regardless of which two of the three available nurses are assigned to NIGHT, the remaining available nurses cannot simultaneously cover 2 MORNING + 2 EVENING slots given the system's shift sequencing constraints. We further showed that this proof holds in Phase 2 as well, because the emergency override pool is empty for all blocked nurses due to the constraint escalation.

The analysis surfaces a broader principle: in multi-phase scheduling systems, the data layer's constraint type field is a *safety-critical attribute*. Write operations that silently alter constraint types from soft to hard can disable feasibility guarantees without producing observable errors at write time. Robust systems must enforce constraint type invariants at the application layer, with explicit validation and rejection of semantically invalid escalations.

---

## References

[1] Cheang, B., Li, H., Lim, A., & Rodrigues, B. (2003). Nurse rostering problems — a bibliographic survey. *European Journal of Operational Research*, 151(3), 447–460.

[2] Ernst, A. T., Jiang, H., Krishnamoorthy, M., & Sier, D. (2004). Staff scheduling and rostering: A review of applications, methods and models. *European Journal of Operational Research*, 153(1), 3–27.

[3] Perron, L., & Furnon, V. (2023). OR-Tools v9.x. Google LLC. https://developers.google.com/optimization

[4] Dechter, R. (2003). *Constraint Processing*. Morgan Kaufmann.

[5] Borning, A., Freeman-Benson, B., & Wilson, M. (1992). Constraint hierarchies. *Lisp and Symbolic Computation*, 5(3), 223–270.

[6] Van den Bergh, J., Beliën, J., De Bruecker, P., Demeulemeester, E., & De Boeck, L. (2013). Personnel scheduling: A literature review. *European Journal of Operational Research*, 226(3), 367–385.

[7] Burke, E. K., De Causmaecker, P., Berghe, G. V., & Van Landeghem, H. (2004). The state of the art of nurse rostering. *Journal of Scheduling*, 7(6), 441–499.

[8] Aickelin, U., & Dowsland, K. A. (2000). Exploiting problem structure in a genetic algorithm approach to a nurse rostering problem. *Journal of Scheduling*, 3(3), 139–153.

[9] Rossi, F., Van Beek, P., & Walsh, T. (Eds.). (2006). *Handbook of Constraint Programming*. Elsevier.

[10] Wallace, M. (1994). Practical applications of constraint programming. *Constraints*, 1(1–2), 139–168.
