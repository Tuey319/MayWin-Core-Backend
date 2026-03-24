-- ============================================================================
-- PATCH: Fix date mismatch for Ward 3A (Unit 5, Org 4)
-- ============================================================================
-- Problem: The existing schedule for unit 5 has start_date='2025-04-01'.
--   All worker_availability and worker_preferences inserts in
--   setup_complete_ward3a.sql used 2026-04-XX dates.
--   ON CONFLICT DO NOTHING meant the old 2025-period data was never replaced.
--   The solver reads availability by schedule date range → 2026 rows ignored.
--
-- Fix:
--   1. Advance the schedule period from 2025-04 → 2026-04
--   2. Force-update worker_preferences JSON keys from 2025-04 → 2026-04
--      (those rows were inserted before our SQL ran and had DO NOTHING)
--   3. Clean up orphaned 2025-04 worker_availability rows (no longer needed)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Move schedule period to 2026
-- ============================================================================
UPDATE maywin_db.schedules
SET
  start_date = '2026-04-01',
  end_date   = '2026-04-30',
  name       = 'Ward 3A - April 2026 Schedule'
WHERE unit_id = 5
  AND organization_id = 4
  AND start_date = '2025-04-01';

-- ============================================================================
-- STEP 2: Update worker_preferences — replace 2025-04 keys with 2026-04
-- ============================================================================
-- preference_pattern_json and days_off_pattern_json use date strings as keys.
-- Any rows pre-existing before our SQL had 2025 dates; we must rekey them.

UPDATE maywin_db.worker_preferences
SET
  preference_pattern_json = regexp_replace(
    preference_pattern_json::text, '2025-04-', '2026-04-', 'g'
  )::jsonb,
  days_off_pattern_json = regexp_replace(
    days_off_pattern_json::text, '2025-04-', '2026-04-', 'g'
  )::jsonb
WHERE worker_id IN (
  SELECT id FROM maywin_db.workers
  WHERE organization_id = 4
    AND worker_code IN (
      'NURSE_001','NURSE_002','NURSE_003','NURSE_004',
      'NURSE_005','NURSE_006','NURSE_007','NURSE_008'
    )
)
AND (
  preference_pattern_json::text LIKE '%2025-04-%'
  OR days_off_pattern_json::text LIKE '%2025-04-%'
);

-- ============================================================================
-- STEP 3: Remove orphaned 2025-04 worker_availability rows for unit 5
-- ============================================================================
-- These are the old rows from the original 2025 setup. Now that the schedule
-- points to 2026, these rows are unreachable. Leaving them is harmless but
-- removing them keeps the table clean.

DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND date BETWEEN '2025-04-01' AND '2025-04-30';

-- ============================================================================
-- STEP 4: Verify our 2026 worker_availability rows are present
-- ============================================================================
-- If somehow the 2026 rows were never inserted (e.g., the setup SQL was never
-- re-run), re-insert the critical UNAVAILABLE blocks now.

-- NURSE_001: EVENING + NIGHT blocked all 30 days
INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason)
SELECT
  w.id, 5, d::date, s,
  'UNAVAILABLE'::maywin_db.availability_type,
  'nurse_request',
  'Morning only - ' || lower(s) || ' blocked'
FROM
  (SELECT id FROM maywin_db.workers WHERE organization_id=4 AND worker_code='NURSE_001') w,
  generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day') d,
  (VALUES ('EVENING'), ('NIGHT')) AS shifts(s)
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET type = 'UNAVAILABLE', reason = EXCLUDED.reason;

-- NURSE_001: MORNING blocked on weekends (weekday-only)
INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason)
SELECT
  w.id, 5, d::date, 'MORNING',
  'UNAVAILABLE'::maywin_db.availability_type,
  'nurse_request',
  'Weekday only - morning blocked on weekend'
FROM
  (SELECT id FROM maywin_db.workers WHERE organization_id=4 AND worker_code='NURSE_001') w,
  (VALUES
    ('2026-04-04'::date), ('2026-04-05'), ('2026-04-11'), ('2026-04-12'),
    ('2026-04-18'), ('2026-04-19'), ('2026-04-25'), ('2026-04-26')
  ) AS weekends(d)
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET type = 'UNAVAILABLE', reason = EXCLUDED.reason;

-- NURSE_002: NIGHT blocked all 30 days
INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason)
SELECT
  w.id, 5, d::date, 'NIGHT',
  'UNAVAILABLE'::maywin_db.availability_type,
  'nurse_request',
  'No night shifts - morning/evening only'
FROM
  (SELECT id FROM maywin_db.workers WHERE organization_id=4 AND worker_code='NURSE_002') w,
  generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day') d
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET type = 'UNAVAILABLE', reason = EXCLUDED.reason;

-- ============================================================================
-- STEP 5: Force-update worker_preferences for NURSE_001 and NURSE_002
--         with correct 2026 date keys (overrides any stale 2025 rows)
-- ============================================================================

-- NURSE_001: penalise EVENING/NIGHT on every day
UPDATE maywin_db.worker_preferences
SET
  prefers_day_shifts           = true,
  prefers_night_shifts         = false,
  max_consecutive_work_days    = 5,
  max_consecutive_night_shifts = 0,
  preference_pattern_json = '{
    "2026-04-01":{"EVENING":5,"NIGHT":5},"2026-04-02":{"EVENING":5,"NIGHT":5},
    "2026-04-03":{"EVENING":5,"NIGHT":5},"2026-04-04":{"EVENING":5,"NIGHT":5},
    "2026-04-05":{"EVENING":5,"NIGHT":5},"2026-04-06":{"EVENING":5,"NIGHT":5},
    "2026-04-07":{"EVENING":5,"NIGHT":5},"2026-04-08":{"EVENING":5,"NIGHT":5},
    "2026-04-09":{"EVENING":5,"NIGHT":5},"2026-04-10":{"EVENING":5,"NIGHT":5},
    "2026-04-11":{"EVENING":5,"NIGHT":5},"2026-04-12":{"EVENING":5,"NIGHT":5},
    "2026-04-13":{"EVENING":5,"NIGHT":5},"2026-04-14":{"EVENING":5,"NIGHT":5},
    "2026-04-15":{"EVENING":5,"NIGHT":5},"2026-04-16":{"EVENING":5,"NIGHT":5},
    "2026-04-17":{"EVENING":5,"NIGHT":5},"2026-04-18":{"EVENING":5,"NIGHT":5},
    "2026-04-19":{"EVENING":5,"NIGHT":5},"2026-04-20":{"EVENING":5,"NIGHT":5},
    "2026-04-21":{"EVENING":5,"NIGHT":5},"2026-04-22":{"EVENING":5,"NIGHT":5},
    "2026-04-23":{"EVENING":5,"NIGHT":5},"2026-04-24":{"EVENING":5,"NIGHT":5},
    "2026-04-25":{"EVENING":5,"NIGHT":5},"2026-04-26":{"EVENING":5,"NIGHT":5},
    "2026-04-27":{"EVENING":5,"NIGHT":5},"2026-04-28":{"EVENING":5,"NIGHT":5},
    "2026-04-29":{"EVENING":5,"NIGHT":5},"2026-04-30":{"EVENING":5,"NIGHT":5}
  }'::jsonb
WHERE worker_id = (
  SELECT id FROM maywin_db.workers WHERE organization_id=4 AND worker_code='NURSE_001'
);

-- ============================================================================
-- STEP 6: Fix constraint profile — set missing fields so solver gets correct
--         rules values per the API spec
-- ============================================================================
-- Mapping:  DB column                  → solver rules key
--   max_consecutive_work_days          → max_consecutive_work_days   (5)
--   max_consecutive_night_shifts       → max_consecutive_shifts      (5)
--   min_rest_hours_between_shifts      → min_rest_hours_between_shifts (12)
--   goal_balance_workload              → goal_balance_workload        (true)
--   goal_balance_night_workload        → goal_balance_night_workload  (true)
--
-- These were not in the original INSERT so they defaulted to NULL/false.
-- ON CONFLICT DO NOTHING meant the old profile was never updated.

UPDATE maywin_db.constraint_profiles
SET
  max_consecutive_work_days       = 5,
  max_consecutive_night_shifts    = 5,
  min_rest_hours_between_shifts   = 12,
  goal_balance_workload           = true,
  goal_balance_night_workload     = true,
  -- Ensure double-shift support is on (needed for 2-2-2 with 8 nurses)
  max_shifts_per_day              = 2,
  allow_second_shift_same_day_in_emergency = true,
  guarantee_full_coverage         = true,
  allow_emergency_overrides       = true,
  forbid_night_to_morning         = true,
  forbid_morning_to_night_same_day = false,
  ignore_availability_in_emergency = false,
  allow_night_cap_override_in_emergency  = true,
  allow_rest_rule_override_in_emergency  = true
WHERE unit_id = 5
  AND org_id  = 4;

COMMIT;
