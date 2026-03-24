-- ============================================================================
-- PATCH: Ward A (Unit 3, Org 2) — Fix coverage + worker parameters
-- ============================================================================
-- Fixes identified from quality check of April 2026 schedule:
--   1. Coverage 2-1-1 every day  → needs 2-2-2 (update coverage_rules)
--   2. Workers 62, 67 work 15 days (need 18) → adjust regular_shifts_per_period
--   3. Worker 64 works 19 days (need 18)     → cap max_overtime_shifts = 0
--   4. 2-2-2 needs 180 slot-assignments/month; 7 workers × 18 days = 126 only.
--      Double shifts (2 shifts/day) enabled via constraint profile max_shifts_per_day=2
--
-- Target: organization_id=2, unit_id=3
-- Valid AvailabilityType values: AVAILABLE, UNAVAILABLE, PREFERRED, AVOID, DAY_OFF
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: Fix coverage rules for unit 3
-- ============================================================================
-- Before: EVENING and NIGHT min_workers = 1 (produced 2-1-1 every day)
-- After:  EVENING and NIGHT min_workers = 2 (target 2-2-2)

UPDATE maywin_db.coverage_rules
SET min_workers = 2
WHERE unit_id = 3
  AND shift_code IN ('EVENING', 'NIGHT')
  AND min_workers < 2;

-- ============================================================================
-- PHASE 2: Fix worker parameters for unit 3
-- ============================================================================

-- 2a. Set all active unit-3 workers to regular_shifts_per_period = 18
UPDATE maywin_db.workers
SET regular_shifts_per_period = 18
WHERE id IN (61, 62, 63, 64, 65, 66, 67)
  AND organization_id = 2;

-- 2b. Worker 64 had 19 working days (1 over) — hard-cap OT at 0
UPDATE maywin_db.workers
SET max_overtime_shifts = 0
WHERE id = 64
  AND organization_id = 2;

-- 2c. All other workers — allow up to 2 OT shifts as buffer
UPDATE maywin_db.workers
SET max_overtime_shifts = 2
WHERE id IN (61, 62, 63, 65, 66, 67)
  AND organization_id = 2;

-- ============================================================================
-- PHASE 3: Enable double shifts via constraint profile
-- ============================================================================
-- Double shifts (morning+evening or night+evening) are the ONLY way to reach
-- 2-2-2 coverage with 7 workers × 18 days (126 slots < 180 needed).
-- Controlled by max_shifts_per_day and allow_second_shift_same_day_in_emergency.

UPDATE maywin_db.constraint_profiles
SET
  max_shifts_per_day                       = 2,
  allow_second_shift_same_day_in_emergency = true,
  guarantee_full_coverage                  = true,
  allow_emergency_overrides                = true
WHERE unit_id = 3;

-- ============================================================================
-- PHASE 4: Shift restrictions for worker 61 (nurse 1 — morning/weekday only)
-- ============================================================================

-- 4a. Block EVENING and NIGHT all 30 days
INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason)
SELECT
  61,
  3,
  d::date,
  s,
  'UNAVAILABLE',
  'MANUAL',
  'Morning only - office hours worker'
FROM generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day') d
CROSS JOIN (VALUES ('EVENING'), ('NIGHT')) AS shifts(s)
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET type = 'UNAVAILABLE', reason = EXCLUDED.reason;

-- 4b. Block MORNING on weekends (nurse 1 is weekday only)
INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason)
VALUES
  (61, 3, '2026-04-04', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked'),
  (61, 3, '2026-04-05', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked'),
  (61, 3, '2026-04-11', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked'),
  (61, 3, '2026-04-12', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked'),
  (61, 3, '2026-04-18', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked'),
  (61, 3, '2026-04-19', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked'),
  (61, 3, '2026-04-25', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked'),
  (61, 3, '2026-04-26', 'MORNING', 'UNAVAILABLE', 'MANUAL', 'Weekday only - weekend blocked')
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET type = 'UNAVAILABLE', reason = EXCLUDED.reason;

-- ============================================================================
-- PHASE 5: Shift restrictions for worker 62 (nurse 2 — no night shifts)
-- ============================================================================

INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason)
SELECT
  62,
  3,
  d::date,
  'NIGHT',
  'UNAVAILABLE',
  'MANUAL',
  'No night shifts - morning/evening only'
FROM generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day') d
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET type = 'UNAVAILABLE', reason = EXCLUDED.reason;

-- ============================================================================
-- PHASE 6: Soft preference penalties for worker 61 (belt-and-suspenders)
-- ============================================================================
-- positive penalty value = solver tries to avoid assigning that shift

INSERT INTO maywin_db.worker_preferences
  (worker_id, prefers_day_shifts, prefers_night_shifts,
   max_consecutive_work_days, max_consecutive_night_shifts,
   preference_pattern_json, days_off_pattern_json)
VALUES (
  61,
  true,
  false,
  5,
  0,
  jsonb_build_object(
    '2026-04-01', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-02', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-03', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-04', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-05', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-06', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-07', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-08', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-09', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-10', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-11', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-12', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-13', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-14', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-15', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-16', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-17', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-18', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-19', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-20', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-21', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-22', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-23', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-24', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-25', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-26', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-27', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-28', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-29', jsonb_build_object('EVENING', 5, 'NIGHT', 5),
    '2026-04-30', jsonb_build_object('EVENING', 5, 'NIGHT', 5)
  ),
  '{}'::jsonb
)
ON CONFLICT (worker_id)
DO UPDATE SET
  prefers_day_shifts           = true,
  prefers_night_shifts         = false,
  max_consecutive_work_days    = 7,
  max_consecutive_night_shifts = 0,
  preference_pattern_json      = EXCLUDED.preference_pattern_json;

COMMIT;
