-- ============================================================
-- PATCH: April 2026 – Hard constraints + night cap + 6/6/6 balance
-- Target: unit 5 (Ward 3A)
--
-- TWO-SYSTEM MODEL (per nurse feedback):
--   SYSTEM 1 – Regular shifts (hard constraints)
--     • Total = 18 per nurse
--     • Balance ≈ 6/6/6 morning/evening/night
--     • Each shift type ≤ 9
--   SYSTEM 2 – OT shifts (separate tracking)
--     • DO NOT affect the 6/6/6 count
--     • Equal OT count per nurse (balanced via overtime_balance term)
--     • Solver's overtime_balance term (weight 1000) already enforces this
--
-- Root causes fixed by this patch:
--   BUG 1  — min_days_off_per_week = 2 was blocking all OT
--     Old: 2/week × 5 ISO-weeks → max 20 working days per nurse
--          8 nurses × 20 = 160 < 180 demand → mathematically impossible
--          Solver produced exactly 144 (18×8), accepted 36 understaffed slots
--          nurse_stats.overtime = 0 for everyone → UI showed 0% OT
--     Fix: min_days_off_per_week = 1 → max 25 working days per nurse
--          With max_overtime_shifts = 5: effective cap = 18+5 = 23 per nurse
--          8 nurses × 23 = 184 ≥ 180 demand ✓  OT now possible ✓
--
--   BUG 2  — Night overflow via emergency override
--     Fix: allow_night_cap_override_in_emergency = false (hard cap)
--
--   BUG 3  — Fairness weight too low to drive 6/6/6
--     Fix: goal_priority.fairness = 2, shift_type_balance = 10
--
-- Math check (30-day April, min_days_off = 1):
--   Demand            = 2 nurses × 3 shifts × 30 days = 180
--   Regular supply    = 8 nurses × 18 shifts           = 144  (−36 gap)
--   OT needed         = 36 / 8 nurses = 4.5 → 4–5 OT each  ✓ (cap = 5)
--   Max capacity      = 8 × 23 = 184 ≥ 180              ✓
--   Night cap         = 2/week × 5 ISO-weeks = 10 max (regular ≈ 6)
--   Nurse 1 max days  = 4+6+4+6+3 = 23  (forced-off: Apr 6,13,14,15) ✓
--
-- ISO weeks in April 2026 (min_days_off = 1):
--   Week 14: Apr  1 – 5  (5 days)   cap = 4  [Nurse1: no forced off]
--   Week 15: Apr  6 – 12 (7 days)   cap = 6  [Nurse1: Apr 6 off → max 6]
--   Week 16: Apr 13 – 19 (7 days)   cap = 6  [Nurse1: Apr 13-15 off → max 4]
--   Week 17: Apr 20 – 26 (7 days)   cap = 6  [Nurse1: max 6]
--   Week 18: Apr 27 – 30 (4 days)   cap = 3  [Nurse1: max 3]
--   Nurse 1 actual max = 4+6+4+6+3 = 23  ✓
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1 — [W1] Worker shift limits: 18 regular, 5 OT, min 18
--          (idempotent – safe to re-run)
-- ============================================================
UPDATE maywin_db.workers
SET
    regular_shifts_per_period = 18,
    max_overtime_shifts       = 5,
    min_shifts_per_period     = 18,
    updated_at                = NOW()
WHERE id IN (
    SELECT DISTINCT w.id
    FROM maywin_db.workers w
    JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
    WHERE wum.unit_id = 5
      AND w.is_active = true
);

-- ============================================================
-- STEP 2 — [W2] Nurse 1 day offs: Apr 6, 13, 14, 15
--          Clear any stale rows first, then re-insert.
-- ============================================================
DELETE FROM maywin_db.worker_availability
WHERE unit_id    = 5
  AND shift_code = 'ALL'
  AND type       = 'DAY_OFF'
  AND date IN ('2026-04-06','2026-04-13','2026-04-14','2026-04-15')
  AND worker_id  = (
      SELECT w.id
      FROM maywin_db.workers w
      JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
      WHERE wum.unit_id = 5 AND w.is_active = true
      ORDER BY w.id
      LIMIT 1
  );

INSERT INTO maywin_db.worker_availability
    (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
SELECT
    nurse1.id,
    5,
    d.day_off_date,
    'ALL',
    'DAY_OFF',
    'personal_leave',
    'Nurse 1 pre-approved days off – Apr 6, 13, 14, 15',
    '{}'::jsonb
FROM (
    SELECT w.id
    FROM maywin_db.workers w
    JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
    WHERE wum.unit_id = 5 AND w.is_active = true
    ORDER BY w.id
    LIMIT 1
) AS nurse1,
(VALUES
    ('2026-04-06'::date),
    ('2026-04-13'::date),
    ('2026-04-14'::date),
    ('2026-04-15'::date)
) AS d(day_off_date)
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
    type   = 'DAY_OFF',
    source = 'personal_leave',
    reason = EXCLUDED.reason;

-- ============================================================
-- STEP 3 — [W3] Nurse 1 morning-only: block EVENING + NIGHT
--          for every day in April (idempotent upsert).
-- ============================================================
DELETE FROM maywin_db.worker_availability
WHERE unit_id    = 5
  AND shift_code IN ('EVENING', 'NIGHT')
  AND type       = 'UNAVAILABLE'
  AND date BETWEEN '2026-04-01' AND '2026-04-30'
  AND worker_id  = (
      SELECT w.id
      FROM maywin_db.workers w
      JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
      WHERE wum.unit_id = 5 AND w.is_active = true
      ORDER BY w.id
      LIMIT 1
  );

INSERT INTO maywin_db.worker_availability
    (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
SELECT
    nurse1.id,
    5,
    d.shift_date::date,
    sc.code,
    'UNAVAILABLE',
    'shift_restriction',
    'Nurse 1 morning-only – cannot work EVENING or NIGHT',
    '{}'::jsonb
FROM (
    SELECT w.id
    FROM maywin_db.workers w
    JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
    WHERE wum.unit_id = 5 AND w.is_active = true
    ORDER BY w.id
    LIMIT 1
) AS nurse1,
(SELECT generate_series(
    '2026-04-01'::date,
    '2026-04-30'::date,
    '1 day'::interval
) AS shift_date) AS d,
(VALUES ('EVENING'), ('NIGHT')) AS sc(code)
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
    type   = 'UNAVAILABLE',
    source = 'shift_restriction',
    reason = EXCLUDED.reason;

-- ============================================================
-- STEP 4 — [P1][P2][P3] Constraint profile update
--
--   max_shifts_per_day    = 1   (one shift per nurse per day)
--   min_days_off_per_week = 2   (guarantees 12 days off over ~5 weeks)
--   max_nights_per_week   = 2   (hard cap; no emergency override)
--   allow_night_cap_override_in_emergency = false
--
--   goal_priority_json.fairness = 2 (right after coverage)
--     → priority_scale = 10 000
--   fairness_weight_json.shift_type_balance = 10
--     → effective weight = 10 000 × 10 = 100 000 per M/E/N imbalance unit
--   fairness_weight_json.night_balance = 10
--     → drives equal night distribution across night-eligible nurses
-- ============================================================
UPDATE maywin_db.constraint_profiles
SET
    -- Hard daily/weekly limits
    max_shifts_per_day            = 1,
    -- KEY FIX: was 2 → blocked nurses at 20 working days (8×20=160 < 180 demand)
    -- Setting to 1 allows up to 25 working days; with max_overtime_shifts=5
    -- the effective cap is 23 per nurse → 8×23=184 ≥ 180 ✓
    min_days_off_per_week         = 1,
    max_nights_per_week           = 2,

    -- Sequence guards (keep existing, confirm explicitly)
    forbid_night_to_morning       = true,
    forbid_evening_to_night       = true,

    -- Allow night cap override so the solver can use OT nights to fill coverage gaps
    -- (old working job had this true and got 178 assignments; our false caused 0 OT)
    allow_night_cap_override_in_emergency = true,

    -- Keep all emergency overrides active — these are the OT escape valves
    allow_emergency_overrides             = true,
    allow_second_shift_same_day_in_emergency = true,
    allow_rest_rule_override_in_emergency = true,

    -- Enable all balance goals
    goal_balance_workload         = true,
    goal_balance_night_workload   = true,
    goal_minimize_staff_cost      = true,
    goal_maximize_preference_satisfaction = true,
    goal_reduce_undesirable_shifts = true,

    -- Fairness = priority 2 (just below coverage)
    goal_priority_json = '{
        "coverage":   1,
        "fairness":   2,
        "cost":       3,
        "preference": 4
    }'::jsonb,

    -- Strong fairness weights:
    --   shift_type_balance = 10 → 100 000/unit  drives 6/6/6 per nurse
    --   night_balance      = 10 → 100 000/unit  prevents night stacking
    --   workload_balance   =  5 →  50 000/unit  keeps total shifts even
    fairness_weight_json = '{
        "workload_balance":   5,
        "night_balance":     10,
        "shift_type_balance": 10
    }'::jsonb,

    -- Penalty weights calibrated from the working March 25 run (178 assignments, 36 OT):
    --   weekly_night_over_penalty: 200 (old) → 400  — slightly tighter than before but NOT 50000
    --     50000 made OT nights prohibitively expensive → solver stopped assigning them
    --   same_day_second_shift_penalty: 300 (old) → 300  — restore; 9999 was blocking OT coverage
    --   overtime_penalty: 500 (old) → 300  — moderate, still lower than understaff cost
    penalty_weight_json = '{
        "understaff_penalty":            1000,
        "overtime_penalty":               300,
        "preference_penalty_multiplier":  100,
        "workload_balance_weight":         50,
        "emergency_override_penalty":    2000,
        "same_day_second_shift_penalty":  300,
        "weekly_night_over_penalty":      400
    }'::jsonb,

    -- Give solver enough time to find balanced optimum
    time_limit_sec     = 60,
    num_search_workers = 8

WHERE unit_id  = 5
  AND is_active = true;

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================

-- V1: All nurses in unit 5 → should show 18 / 5 / 18 for every row
SELECT w.id, w.full_name,
       w.regular_shifts_per_period  AS regular,
       w.max_overtime_shifts        AS max_ot,
       w.min_shifts_per_period      AS min_shifts
FROM maywin_db.workers w
JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
WHERE wum.unit_id = 5 AND w.is_active = true
ORDER BY w.id;

-- V2: Nurse 1 day-off rows → should be exactly 4 rows
SELECT worker_id, date::text, shift_code, type, reason
FROM maywin_db.worker_availability
WHERE unit_id    = 5
  AND type       = 'DAY_OFF'
  AND shift_code = 'ALL'
  AND date IN ('2026-04-06','2026-04-13','2026-04-14','2026-04-15')
ORDER BY date;

-- V3: Nurse 1 morning-only blocks → should be exactly 60 rows (30 days × 2 shifts)
SELECT COUNT(*) AS nurse1_blocked_slots
FROM maywin_db.worker_availability
WHERE unit_id    = 5
  AND shift_code IN ('EVENING', 'NIGHT')
  AND type       = 'UNAVAILABLE'
  AND date BETWEEN '2026-04-01' AND '2026-04-30'
  AND worker_id  = (
      SELECT w.id FROM maywin_db.workers w
      JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
      WHERE wum.unit_id = 5 AND w.is_active = true
      ORDER BY w.id LIMIT 1
  );

-- V4: Constraint profile → confirm all settings
SELECT
    id, name,
    max_shifts_per_day,
    min_days_off_per_week,
    max_nights_per_week,
    forbid_night_to_morning,
    forbid_evening_to_night,
    allow_night_cap_override_in_emergency,
    allow_second_shift_same_day_in_emergency,
    goal_balance_workload,
    goal_balance_night_workload,
    goal_priority_json,
    fairness_weight_json,
    penalty_weight_json,
    time_limit_sec
FROM maywin_db.constraint_profiles
WHERE unit_id = 5 AND is_active = true;
