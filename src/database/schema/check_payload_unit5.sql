-- ============================================================================
-- DIAGNOSTIC: Verify Ward 3A (Unit 5, Org 4) payload before solver run
-- ============================================================================
-- Run this after patch_fix_dates_unit5.sql to confirm everything is correct.
-- Each section maps to a field in the NormalizedInputV1 the solver receives.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEDULE — horizon dates the solver will use
-- ----------------------------------------------------------------------------
SELECT
  id,
  name,
  start_date,
  end_date,
  status,
  constraint_profile_id,
  CASE
    WHEN start_date = '2026-04-01' AND end_date = '2026-04-30' THEN '✓ CORRECT'
    ELSE '✗ WRONG DATE — run patch_fix_dates_unit5.sql'
  END AS date_check
FROM maywin_db.schedules
WHERE unit_id = 5 AND organization_id = 4
ORDER BY id;

-- ----------------------------------------------------------------------------
-- 2. CONSTRAINT PROFILE — maps to solver "rules" object
-- ----------------------------------------------------------------------------
SELECT
  id,
  name,
  max_shifts_per_day,
  max_consecutive_work_days,
  max_consecutive_night_shifts   AS "→ solver: max_consecutive_shifts",
  min_rest_hours_between_shifts,
  min_days_off_per_week,
  max_nights_per_week,
  forbid_night_to_morning,
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
  -- Expected values check
  CASE
    WHEN max_consecutive_work_days = 5
     AND max_consecutive_night_shifts = 5
     AND min_rest_hours_between_shifts = 12
     AND max_shifts_per_day = 2
     AND ignore_availability_in_emergency = false
     AND goal_balance_workload = true
     AND goal_balance_night_workload = true
    THEN '✓ ALL CORRECT'
    ELSE '✗ MISMATCH — check fields above'
  END AS constraint_check
FROM maywin_db.constraint_profiles
WHERE unit_id = 5 AND org_id = 4;

-- ----------------------------------------------------------------------------
-- 3. COVERAGE RULES — maps to solver "demand" (min workers per shift/day)
-- ----------------------------------------------------------------------------
SELECT
  shift_code,
  day_type,
  min_workers,
  max_workers,
  CASE
    WHEN shift_code IN ('EVENING', 'NIGHT') AND min_workers < 2 THEN '✗ SHOULD BE 2'
    WHEN shift_code = 'MORNING' AND min_workers < 2 THEN '✗ SHOULD BE 2'
    ELSE '✓'
  END AS check
FROM maywin_db.coverage_rules
WHERE unit_id = 5
ORDER BY shift_code, day_type;

-- ----------------------------------------------------------------------------
-- 4. WORKERS — maps to solver "nurses" array
-- ----------------------------------------------------------------------------
SELECT
  w.id,
  w.worker_code,
  w.full_name,
  w.is_active,
  w.is_backup_worker,
  w.regular_shifts_per_period,
  w.max_overtime_shifts,
  w.min_shifts_per_period,
  CASE
    WHEN w.worker_code = 'NURSE_001' AND w.max_overtime_shifts = 0 AND w.regular_shifts_per_period = 18 THEN '✓'
    WHEN w.worker_code != 'NURSE_001' AND w.max_overtime_shifts = 2 AND w.regular_shifts_per_period = 18 THEN '✓'
    WHEN w.worker_code = 'NURSE_008' THEN '✓ backup'
    ELSE '✗ CHECK OT/REGULAR'
  END AS shift_limit_check
FROM maywin_db.workers w
WHERE w.organization_id = 4
  AND w.primary_unit_id = 5
ORDER BY w.worker_code;

-- ----------------------------------------------------------------------------
-- 5. WORKER AVAILABILITY — maps to solver "availability" blocks
--    Critical: NURSE_001 must have UNAVAILABLE for EVENING+NIGHT all 30 days
--              NURSE_002 must have UNAVAILABLE for NIGHT all 30 days
-- ----------------------------------------------------------------------------

-- 5a. Count UNAVAILABLE rows per nurse/shift for April 2026
SELECT
  w.worker_code,
  wa.shift_code,
  wa.type,
  COUNT(*) AS row_count,
  MIN(wa.date::text) AS first_date,
  MAX(wa.date::text) AS last_date,
  CASE
    WHEN w.worker_code = 'NURSE_001' AND wa.shift_code IN ('EVENING','NIGHT') AND wa.type = 'UNAVAILABLE' AND COUNT(*) = 30 THEN '✓ 30 days blocked'
    WHEN w.worker_code = 'NURSE_001' AND wa.shift_code = 'MORNING'           AND wa.type = 'UNAVAILABLE' AND COUNT(*) = 8  THEN '✓ 8 weekends blocked'
    WHEN w.worker_code = 'NURSE_002' AND wa.shift_code = 'NIGHT'             AND wa.type = 'UNAVAILABLE' AND COUNT(*) = 30 THEN '✓ 30 days blocked'
    ELSE '— (other)'
  END AS expected_check
FROM maywin_db.worker_availability wa
JOIN maywin_db.workers w ON w.id = wa.worker_id
WHERE wa.unit_id = 5
  AND wa.date BETWEEN '2026-04-01' AND '2026-04-30'
GROUP BY w.worker_code, wa.shift_code, wa.type
ORDER BY w.worker_code, wa.shift_code, wa.type;

-- 5b. Confirm NO 2025-04 availability rows remain (orphan check)
SELECT
  COUNT(*) AS orphan_2025_rows,
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Old 2025 rows still present — re-run patch' END AS orphan_check
FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND date BETWEEN '2025-04-01' AND '2025-04-30';

-- ----------------------------------------------------------------------------
-- 6. WORKER PREFERENCES — maps to solver "preferences" penalty map
--    Keys must be 2026-04-XX dates
-- ----------------------------------------------------------------------------
SELECT
  w.worker_code,
  wp.prefers_day_shifts,
  wp.prefers_night_shifts,
  wp.max_consecutive_work_days,
  wp.max_consecutive_night_shifts,
  -- Check preference_pattern_json uses 2026 keys, not 2025
  CASE
    WHEN wp.preference_pattern_json::text LIKE '%2025-04-%' THEN '✗ STILL HAS 2025 DATES — re-run patch'
    WHEN wp.preference_pattern_json::text LIKE '%2026-04-%' THEN '✓ 2026 dates'
    WHEN wp.preference_pattern_json IS NULL OR wp.preference_pattern_json = '{}'::jsonb THEN '— empty'
    ELSE '? check manually'
  END AS pref_pattern_check,
  CASE
    WHEN wp.days_off_pattern_json::text LIKE '%2025-04-%' THEN '✗ STILL HAS 2025 DATES — re-run patch'
    WHEN wp.days_off_pattern_json::text LIKE '%2026-04-%' THEN '✓ 2026 dates'
    WHEN wp.days_off_pattern_json IS NULL OR wp.days_off_pattern_json = '[]'::jsonb OR wp.days_off_pattern_json = '{}'::jsonb THEN '— empty'
    ELSE '? check manually'
  END AS days_off_check,
  -- For NURSE_001 specifically: should penalise EVENING+NIGHT
  CASE
    WHEN w.worker_code = 'NURSE_001' AND wp.preference_pattern_json::text LIKE '%EVENING%' AND wp.preference_pattern_json::text LIKE '%NIGHT%' THEN '✓ EVENING+NIGHT penalised'
    WHEN w.worker_code = 'NURSE_001' THEN '✗ NURSE_001 missing EVENING/NIGHT penalties'
    ELSE '—'
  END AS nurse001_pref_check
FROM maywin_db.worker_preferences wp
JOIN maywin_db.workers w ON w.id = wp.worker_id
WHERE w.organization_id = 4
  AND w.primary_unit_id = 5
ORDER BY w.worker_code;

-- ----------------------------------------------------------------------------
-- 7. SHIFT TEMPLATES — maps to solver "shifts" array
-- ----------------------------------------------------------------------------
SELECT
  code,
  name,
  start_time,
  end_time,
  is_active
FROM maywin_db.shift_templates
WHERE unit_id = 5 AND organization_id = 4
ORDER BY start_time;

-- ----------------------------------------------------------------------------
-- 8. SUMMARY — quick overall pass/fail
-- ----------------------------------------------------------------------------
SELECT
  'Schedule dates'       AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM maywin_db.schedules
    WHERE unit_id=5 AND organization_id=4
      AND start_date='2026-04-01' AND end_date='2026-04-30'
  ) THEN '✓ PASS' ELSE '✗ FAIL' END AS result

UNION ALL SELECT
  'Constraint profile complete',
  CASE WHEN EXISTS (
    SELECT 1 FROM maywin_db.constraint_profiles
    WHERE unit_id=5 AND org_id=4
      AND max_consecutive_work_days = 5
      AND max_consecutive_night_shifts = 5
      AND min_rest_hours_between_shifts = 12
      AND max_shifts_per_day = 2
      AND ignore_availability_in_emergency = false
  ) THEN '✓ PASS' ELSE '✗ FAIL' END

UNION ALL SELECT
  'Coverage rules 2-2-2',
  CASE WHEN (
    SELECT COUNT(*) FROM maywin_db.coverage_rules
    WHERE unit_id=5 AND shift_code IN ('EVENING','NIGHT') AND min_workers >= 2
  ) >= 4 THEN '✓ PASS' ELSE '✗ FAIL' END

UNION ALL SELECT
  'NURSE_001 evening/night blocks (60 rows)',
  CASE WHEN (
    SELECT COUNT(*) FROM maywin_db.worker_availability wa
    JOIN maywin_db.workers w ON w.id=wa.worker_id
    WHERE w.organization_id=4 AND w.worker_code='NURSE_001'
      AND wa.unit_id=5 AND wa.type='UNAVAILABLE'
      AND wa.shift_code IN ('EVENING','NIGHT')
      AND wa.date BETWEEN '2026-04-01' AND '2026-04-30'
  ) = 60 THEN '✓ PASS' ELSE '✗ FAIL' END

UNION ALL SELECT
  'NURSE_001 weekend morning blocks (8 rows)',
  CASE WHEN (
    SELECT COUNT(*) FROM maywin_db.worker_availability wa
    JOIN maywin_db.workers w ON w.id=wa.worker_id
    WHERE w.organization_id=4 AND w.worker_code='NURSE_001'
      AND wa.unit_id=5 AND wa.type='UNAVAILABLE'
      AND wa.shift_code = 'MORNING'
      AND wa.date BETWEEN '2026-04-01' AND '2026-04-30'
  ) = 8 THEN '✓ PASS' ELSE '✗ FAIL' END

UNION ALL SELECT
  'NURSE_002 night blocks (30 rows)',
  CASE WHEN (
    SELECT COUNT(*) FROM maywin_db.worker_availability wa
    JOIN maywin_db.workers w ON w.id=wa.worker_id
    WHERE w.organization_id=4 AND w.worker_code='NURSE_002'
      AND wa.unit_id=5 AND wa.type='UNAVAILABLE'
      AND wa.shift_code = 'NIGHT'
      AND wa.date BETWEEN '2026-04-01' AND '2026-04-30'
  ) = 30 THEN '✓ PASS' ELSE '✗ FAIL' END

UNION ALL SELECT
  'No orphan 2025 availability rows',
  CASE WHEN (
    SELECT COUNT(*) FROM maywin_db.worker_availability
    WHERE unit_id=5 AND date BETWEEN '2025-04-01' AND '2025-04-30'
  ) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END

UNION ALL SELECT
  'Preferences use 2026 dates',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM maywin_db.worker_preferences wp
    JOIN maywin_db.workers w ON w.id=wp.worker_id
    WHERE w.organization_id=4 AND w.primary_unit_id=5
      AND (
        wp.preference_pattern_json::text LIKE '%2025-04-%'
        OR wp.days_off_pattern_json::text LIKE '%2025-04-%'
      )
  ) THEN '✓ PASS' ELSE '✗ FAIL' END

ORDER BY check_name;
