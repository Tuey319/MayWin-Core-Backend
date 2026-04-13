-- ============================================================
-- May 2026 — Unit 5 (Ward 3A)
-- Purpose: Create a new constraint profile + schedule container
--          so the solver can be triggered via API for May 2026.
--
-- STATUS: DRAFT — nurses have not submitted shift requests yet.
--   Final schedule should only be generated after the 20th of April
--   once all nurses submit their day-off / preferred shift requests.
--
-- CALENDAR:
--   Total days   : 31
--   Total demand : 31 × 3 shifts × 2 nurses = 186 slots (ward runs every day)
--
-- NURSE #1 FIXED DAYS OFF (11 days):
--   All Saturdays: May 2,9,16,23,30
--   All Sundays:   May 3,10,17,24,31
--   Public hol:    May 4
--   → Nurse #1 working days: 20
--
-- NURSES #2–8:
--   No fixed days off — solver determines rotation freely
--   regular_shifts_per_nurse = 20, max_overtime = 2
--
-- DAILY DEMAND (all 31 days, ward never closes):
--   Morning  : 2 nurses/day
--   Afternoon: 2 nurses/day
--   Night    : 2 nurses/day
--
-- NURSE RULES:
--   Nurse #1  — special shift type, excluded from balancing rules
--   Nurses #2–8 — subject to all balancing constraints below
--
-- SHIFT BALANCING (Nurses #2–8 only):
--   Max 9 morning  shifts per nurse
--   Max 9 afternoon shifts per nurse
--   Max 9 night    shifts per nurse
--   Equal distribution per shift type (±1)
--
-- OVERTIME:
--   Distributed equally across all nurses
--   Allowed on any shift type (morning / afternoon / night)
--
-- CAPACITY MATH:
--   Demand              = 31 × 3 × 2           = 186 slots
--   Regular supply      = 8 nurses × 20         = 160 shifts  (gap = 26)
--   OT needed           = 26 / 8               ≈ 3.25  → max_ot = 4
--   Max total capacity  = 8 × (20 + 4)          = 192 ≥ 186  ✓
--
-- SOLVER INPUT:
--   regular_shifts_per_nurse : 20
--   max_overtime_per_nurse   : 4  (raised from 2 to cover full 186 demand)
--   max_shifts_per_day       : 2
--   min_days_off_per_week    : 2
--   max_nights_per_week      : 2
--   understaff_penalty       : 200
--   overtime_penalty         : 20
-- ============================================================

SET search_path TO maywin_db;

BEGIN;

-- ============================================================
-- STEP 1 — Raise max_overtime_shifts to 4 for all unit 5 nurses
--           Required: 8×(20+2)=176 < 186 demand → need max_ot ≥ 4
--           8×(20+4)=192 ≥ 186 ✓
-- ============================================================
UPDATE maywin_db.workers
SET
    max_overtime_shifts = 4,
    updated_at          = NOW()
WHERE id IN (
    SELECT worker_id FROM maywin_db.worker_unit_memberships WHERE unit_id = 5
);

WITH

-- Step 1: New constraint profile for May 2026
new_profile AS (
  INSERT INTO maywin_db.constraint_profiles (
    unit_id,
    name,
    description,
    max_shifts_per_day,
    min_days_off_per_week,
    max_nights_per_week,
    forbid_night_to_morning,
    forbid_evening_to_night,
    forbid_morning_to_night_same_day,
    guarantee_full_coverage,
    allow_emergency_overrides,
    allow_second_shift_same_day_in_emergency,
    ignore_availability_in_emergency,
    allow_night_cap_override_in_emergency,
    allow_rest_rule_override_in_emergency,
    goal_minimize_staff_cost,
    goal_maximize_preference_satisfaction,
    goal_balance_workload,
    goal_balance_night_workload,
    goal_reduce_undesirable_shifts,
    goal_priority_json,
    fairness_weight_json,
    penalty_weight_json,
    num_search_workers,
    time_limit_sec,
    is_active,
    attributes,
    created_at
  )
  VALUES (
    5,
    'Ward 3A – May 2026',
    'May 2026. Ward runs all 31 days (demand=186). Nurse #1: 11 fixed days off (Sat/Sun/May4), 20 working days, excluded from balancing. Nurses #2-8: solver-determined rotation, regular=20, max_ot=4 (raised to cover 186 demand), balanced max 9 per shift type.',
    2,      -- max_shifts_per_day (doubles allowed for OT)
    2,      -- min_days_off_per_week (Sat+Sun each week)
    2,      -- max_nights_per_week
    true,   -- forbid_night_to_morning
    true,   -- forbid_evening_to_night
    false,  -- forbid_morning_to_night_same_day
    true,   -- guarantee_full_coverage
    true,   -- allow_emergency_overrides
    true,   -- allow_second_shift_same_day_in_emergency
    false,  -- ignore_availability_in_emergency
    true,   -- allow_night_cap_override_in_emergency
    true,   -- allow_rest_rule_override_in_emergency
    true,   -- goal_minimize_staff_cost
    true,   -- goal_maximize_preference_satisfaction
    true,   -- goal_balance_workload       (equal OT distribution)
    true,   -- goal_balance_night_workload (equal night distribution)
    true,   -- goal_reduce_undesirable_shifts
    '{"coverage": 1, "fairness": 2, "cost": 3, "preference": 4}'::jsonb,
    -- shift_type_balance=10: drives the 6/6/6 (max 9 per type) rule for Nurses #2-8
    -- night_balance=10: prevents night stacking
    -- workload_balance=5: keeps total shifts even across nurses
    '{"workload_balance": 5, "night_balance": 10, "shift_type_balance": 10}'::jsonb,
    '{"understaff_penalty": 200, "overtime_penalty": 20, "preference_penalty_multiplier": 1, "workload_balance_weight": 0}'::jsonb,
    8,
    60.0,
    true,
    '{
      "month": "2026-05",
      "total_demand": 186,
      "nurse1_working_days": 20,
      "nurse1_off_days": 11,
      "nurse1_off_dates": ["2026-05-02","2026-05-03","2026-05-04","2026-05-09","2026-05-10","2026-05-16","2026-05-17","2026-05-23","2026-05-24","2026-05-30","2026-05-31"],
      "regular_shifts_per_nurse": 20,
      "max_overtime_per_nurse": 4,
      "nurse1_excluded_from_balancing": true,
      "max_shifts_per_type": 9,
      "generated_by": "may2026-unit5-schedule.sql",
      "note": "DRAFT — finalize after nurses submit requests (before Apr 20)"
    }'::jsonb,
    NOW()
  )
  RETURNING id
),

-- Step 2: New schedule container linked to the new profile
new_schedule AS (
  INSERT INTO maywin_db.schedules (
    organization_id,
    unit_id,
    name,
    start_date,
    end_date,
    status,
    constraint_profile_id,
    created_by,
    attributes,
    created_at
  )
  SELECT
    u.organization_id,
    5,
    'May 2026 Schedule',
    '2026-05-01',
    '2026-05-31',
    'DRAFT',
    (SELECT id FROM new_profile),
    1,
    '{
      "month": "2026-05",
      "status_reason": "DRAFT – pending nurse shift requests (submit before Apr 20)",
      "total_demand": 186,
      "nurse1_working_days": 20,
      "nurse1_off_days": 11,
      "generated_by": "may2026-unit5-schedule.sql"
    }'::jsonb,
    NOW()
  FROM maywin_db.units u WHERE u.id = 5
  RETURNING id
)

SELECT
  'Created' AS result,
  (SELECT id FROM new_profile)  AS constraint_profile_id,
  (SELECT id FROM new_schedule) AS schedule_id;

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT id, name, max_shifts_per_day, min_days_off_per_week,
       max_nights_per_week, penalty_weight_json, fairness_weight_json, time_limit_sec
FROM maywin_db.constraint_profiles
WHERE unit_id = 5 AND name = 'Ward 3A – May 2026';

SELECT id, name, start_date, end_date, status, constraint_profile_id, attributes
FROM maywin_db.schedules
WHERE unit_id = 5 AND start_date = '2026-05-01';

-- ============================================================
-- PATCH — Fix solver output issues (run after solver completes)
--
-- Problems found in the solver run linked to schedule id=41:
--   1. 4 assignments dated 2026-04-30 — outside the May schedule
--      range (start_date = 2026-05-01). Cause: solver looked one
--      day back to fill overnight transitions; these must be deleted.
--   2. 3 days with no NIGHT coverage: May 11, May 18, May 19.
--      Inserted manually (source='MANUAL') using nurses with no
--      morning shift the following day (avoids night→morning violation).
--
-- Night assignments chosen:
--   May 11 → workers 72, 76  (May 12 morning: 69, 73 — no conflict)
--   May 18 → workers 69, 71  (May 19 morning: 75, 76 — no conflict)
--   May 19 → workers 73, 74  (May 20 morning: 71, 72 — no conflict)
-- ============================================================

BEGIN;

-- 1. Remove out-of-range April 30 assignments from the May schedule
DELETE FROM maywin_db.schedule_assignments
WHERE schedule_id = 41
  AND date = '2026-04-30';

-- 2. Insert missing NIGHT shifts
--    schedule_run_id: latest run for schedule 41
INSERT INTO maywin_db.schedule_assignments
  (schedule_id, schedule_run_id, worker_id, date, shift_code, shift_order, is_overtime, source, attributes, created_at, updated_at)
SELECT
  41,
  (SELECT id FROM maywin_db.schedule_runs WHERE schedule_id = 41 ORDER BY id DESC LIMIT 1),
  w.worker_id,
  w.shift_date,
  'NIGHT',
  1,
  false,
  'MANUAL',
  '{}'::jsonb,
  NOW(),
  NOW()
FROM (VALUES
  (72::bigint, '2026-05-11'::date),
  (76::bigint, '2026-05-11'::date),
  (69::bigint, '2026-05-18'::date),
  (71::bigint, '2026-05-18'::date),
  (73::bigint, '2026-05-19'::date),
  (74::bigint, '2026-05-19'::date)
) AS w(worker_id, shift_date)
ON CONFLICT ON CONSTRAINT sa_run_uniq DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFY — confirm April assignments are gone and nights covered
-- ============================================================

-- Should return 0 rows
SELECT COUNT(*) AS apr30_leftover
FROM maywin_db.schedule_assignments
WHERE schedule_id = 41 AND date = '2026-04-30';

-- Should show 2 rows for each date (shift_code = 'NIGHT')
SELECT date, shift_code, COUNT(*) AS nurse_count
FROM maywin_db.schedule_assignments
WHERE schedule_id = 41
  AND date IN ('2026-05-11', '2026-05-18', '2026-05-19')
  AND shift_code = 'NIGHT'
GROUP BY date, shift_code
ORDER BY date;
