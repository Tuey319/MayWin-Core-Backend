-- ============================================================================
-- COMPLETE WARD 3A SCHEDULING SETUP FOR UNIT 5
-- ============================================================================
-- Organization: 4 (Main Org)
-- Unit: 5 (Ward 3A)
-- Period: April 2026
-- Total Nurses: 8 (7 regular + 1 backup)
--
-- EXECUTION ORDER:
-- 1. setup_unit5_scheduling_infrastructure.sql (Shift Templates, Coverage Rules, Constraint Profile, Schedule)
-- 2. This script (Master coordinator)
-- 3. insert_unit5_nurses.sql (Nurses with preferences and availability)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: INFRASTRUCTURE SETUP
-- ============================================================================
-- Create the foundational scheduling entities

-- 1.1 Create Shift Templates
INSERT INTO maywin_db.shift_templates
(organization_id, unit_id, code, name, start_time, end_time, is_active)
VALUES
(4, 5, 'MORNING', 'Morning Shift', '08:00:00', '16:00:00', true),
(4, 5, 'EVENING', 'Evening Shift', '16:00:00', '24:00:00', true),
(4, 5, 'NIGHT', 'Night Shift', '00:00:00', '08:00:00', true)
ON CONFLICT (organization_id, unit_id, code) DO NOTHING;

-- 1.2 Create Coverage Rules
INSERT INTO maywin_db.coverage_rules
(unit_id, shift_code, day_type, min_workers, max_workers)
VALUES
(5, 'MORNING', 'WEEKDAY', 2, NULL),
(5, 'EVENING', 'WEEKDAY', 2, NULL),
(5, 'NIGHT', 'WEEKDAY', 2, NULL),
(5, 'MORNING', 'WEEKEND', 2, NULL),
(5, 'EVENING', 'WEEKEND', 2, NULL),
(5, 'NIGHT', 'WEEKEND', 2, NULL)
ON CONFLICT DO NOTHING;

-- 1.3 Create Constraint Profile
INSERT INTO maywin_db.constraint_profiles
(
  org_id, unit_id, name, description, assigned_to, color,
  max_shifts_per_day, min_days_off_per_week, max_nights_per_week,
  forbid_night_to_morning, guarantee_full_coverage, allow_emergency_overrides,
  allow_second_shift_same_day_in_emergency, allow_night_cap_override_in_emergency,
  allow_rest_rule_override_in_emergency,
  goal_minimize_staff_cost, goal_maximize_preference_satisfaction,
  goal_balance_workload, goal_balance_night_workload, goal_reduce_undesirable_shifts,
  penalty_weight_json, fairness_weight_json, goal_priority_json,
  num_search_workers, time_limit_sec, is_active
)
VALUES
(4, 5, 'Ward 3A - April 2026', 'Constraint profile for Ward 3A nursing schedule - April 2026', 'Ward 3A', 'primary',
 2, 2, 2, true, true, true, true, true, true, true, true, true, true, true,
 '{
    "understaff_penalty": 1000,
    "overtime_penalty": 500,
    "preference_penalty_multiplier": 100,
    "workload_balance_weight": 50,
    "emergency_override_penalty": 2000,
    "same_day_second_shift_penalty": 300,
    "weekly_night_over_penalty": 200
  }'::jsonb,
 '{
    "workload_balance": 1,
    "night_balance": 2,
    "shift_type_balance": 2
  }'::jsonb,
 '{
    "coverage": 1,
    "cost": 2,
    "preference": 3,
    "fairness": 4
  }'::jsonb,
 8, 15, true)
ON CONFLICT DO NOTHING;

-- 1.4 Create Schedule Container (will link to constraint profile in next step)
-- We need to get the constraint profile ID first
WITH cp_id AS (
  SELECT id FROM maywin_db.constraint_profiles
  WHERE org_id = 4 AND unit_id = 5 AND name = 'Ward 3A - April 2026'
  LIMIT 1
)
INSERT INTO maywin_db.schedules
(organization_id, unit_id, name, start_date, end_date, status, constraint_profile_id, created_by, notes)
SELECT 4, 5, 'Ward 3A - April 2026 Schedule', '2026-04-01'::date, '2026-04-30'::date,
       'DRAFT'::maywin_db.schedule_status, cp_id.id, 1,
       'Nursing schedule for Ward 3A April 2026 with nurse preferences and availability constraints'
FROM cp_id
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 2: INSERT WORKERS
-- ============================================================================

-- 2.1 Insert the 8 nurses
INSERT INTO maywin_db.workers
(organization_id, primary_unit_id, full_name, worker_code, employment_type, weekly_hours, is_active, is_backup_worker, max_overtime_shifts, regular_shifts_per_period, attributes)
VALUES
(4, 5, 'นางสาวอภัสสรณ์ นิจจินทร', 'NURSE_001', 'FULL_TIME', 40, true, false, 0, 18, '{"skills": ["Senior"]}'),
(4, 5, 'นางสาวศิริพรณ์ จิตรหวล', 'NURSE_002', 'FULL_TIME', 40, true, false, 2, 18, '{"skills": []}'),
(4, 5, 'นางสาวสุภิญญา', 'NURSE_003', 'FULL_TIME', 40, true, false, 2, 18, '{"skills": []}'),
(4, 5, 'นางสาวอัญชนา', 'NURSE_004', 'FULL_TIME', 40, true, false, 2, 18, '{"skills": ["Senior"]}'),
(4, 5, 'นางสาวณัชชพร', 'NURSE_005', 'FULL_TIME', 40, true, false, 2, 18, '{"skills": []}'),
(4, 5, 'นางสาวพรลภัส', 'NURSE_006', 'FULL_TIME', 40, true, false, 2, 18, '{"skills": []}'),
(4, 5, 'นางสาวปรัชญาภรณ์', 'NURSE_007', 'FULL_TIME', 40, true, false, 2, 18, '{"skills": ["Senior"]}'),
(4, 5, 'มาย', 'NURSE_008', 'FULL_TIME', 40, true, true, 15, 0, '{"skills": []}')
ON CONFLICT (organization_id, worker_code) DO NOTHING;

-- 2.2 Assign nurses to Unit 5
WITH new_workers AS (
  SELECT id FROM maywin_db.workers
  WHERE organization_id = 4
  AND worker_code IN ('NURSE_001', 'NURSE_002', 'NURSE_003', 'NURSE_004', 'NURSE_005', 'NURSE_006', 'NURSE_007', 'NURSE_008')
)
INSERT INTO maywin_db.worker_unit_memberships (worker_id, unit_id, role_code)
SELECT id, 5, 'NURSE'
FROM new_workers
ON CONFLICT DO NOTHING;

-- 2.3 Create Worker Preferences
WITH worker_ids AS (
  SELECT id, worker_code FROM maywin_db.workers
  WHERE organization_id = 4
  AND worker_code IN ('NURSE_001', 'NURSE_002', 'NURSE_003', 'NURSE_004', 'NURSE_005', 'NURSE_006', 'NURSE_007', 'NURSE_008')
)
INSERT INTO maywin_db.worker_preferences
(worker_id, max_consecutive_night_shifts, preference_pattern_json, days_off_pattern_json)
SELECT
  w.id,
  2,
  CASE
    WHEN w.worker_code = 'NURSE_003' THEN '{"2026-04-01": {"MORNING": 5}, "2026-04-03": {"NIGHT": 5}, "2026-04-06": {"MORNING": 5}, "2026-04-17": {"NIGHT": 5}, "2026-04-20": {"MORNING": 5}, "2026-04-24": {"NIGHT": 5}, "2026-04-26": {"MORNING": 5}, "2026-04-28": {"NIGHT": 5}}'::jsonb
    WHEN w.worker_code = 'NURSE_005' THEN '{"2026-04-02": {"NIGHT": 5}, "2026-04-09": {"NIGHT": 5}, "2026-04-15": {"EVENING": 5}, "2026-04-24": {"NIGHT": 5}, "2026-04-25": {"NIGHT": 5}, "2026-04-28": {"NIGHT": 5}}'::jsonb
    WHEN w.worker_code = 'NURSE_006' THEN '{"2026-04-04": {"NIGHT": 5}}'::jsonb
    WHEN w.worker_code = 'NURSE_007' THEN '{"2026-04-04": {"NIGHT": 5}, "2026-04-10": {"NIGHT": 5}, "2026-04-24": {"NIGHT": 5}, "2026-04-28": {"EVENING": 5}}'::jsonb
    WHEN w.worker_code = 'NURSE_001' THEN '{"2026-04-01": {"EVENING": 5, "NIGHT": 5}, "2026-04-02": {"EVENING": 5, "NIGHT": 5}, "2026-04-03": {"EVENING": 5, "NIGHT": 5}, "2026-04-04": {"EVENING": 5, "NIGHT": 5}, "2026-04-05": {"EVENING": 5, "NIGHT": 5}, "2026-04-06": {"EVENING": 5, "NIGHT": 5}, "2026-04-07": {"EVENING": 5, "NIGHT": 5}, "2026-04-08": {"EVENING": 5, "NIGHT": 5}, "2026-04-09": {"EVENING": 5, "NIGHT": 5}, "2026-04-10": {"EVENING": 5, "NIGHT": 5}, "2026-04-11": {"EVENING": 5, "NIGHT": 5}, "2026-04-12": {"EVENING": 5, "NIGHT": 5}, "2026-04-13": {"EVENING": 5, "NIGHT": 5}, "2026-04-14": {"EVENING": 5, "NIGHT": 5}, "2026-04-15": {"EVENING": 5, "NIGHT": 5}, "2026-04-16": {"EVENING": 5, "NIGHT": 5}, "2026-04-17": {"EVENING": 5, "NIGHT": 5}, "2026-04-18": {"EVENING": 5, "NIGHT": 5}, "2026-04-19": {"EVENING": 5, "NIGHT": 5}, "2026-04-20": {"EVENING": 5, "NIGHT": 5}, "2026-04-21": {"EVENING": 5, "NIGHT": 5}, "2026-04-22": {"EVENING": 5, "NIGHT": 5}, "2026-04-23": {"EVENING": 5, "NIGHT": 5}, "2026-04-24": {"EVENING": 5, "NIGHT": 5}, "2026-04-25": {"EVENING": 5, "NIGHT": 5}, "2026-04-26": {"EVENING": 5, "NIGHT": 5}, "2026-04-27": {"EVENING": 5, "NIGHT": 5}, "2026-04-28": {"EVENING": 5, "NIGHT": 5}, "2026-04-29": {"EVENING": 5, "NIGHT": 5}, "2026-04-30": {"EVENING": 5, "NIGHT": 5}}'::jsonb
    ELSE '{}'::jsonb
  END,
  CASE
    WHEN w.worker_code = 'NURSE_003' THEN '["2026-04-04", "2026-04-05", "2026-04-18", "2026-04-19", "2026-04-25", "2026-04-29"]'::jsonb
    WHEN w.worker_code = 'NURSE_004' THEN '["2026-04-04", "2026-04-05", "2026-04-06"]'::jsonb
    WHEN w.worker_code = 'NURSE_005' THEN '["2026-04-01", "2026-04-10", "2026-04-11", "2026-04-12", "2026-04-13", "2026-04-14", "2026-04-26"]'::jsonb
    WHEN w.worker_code = 'NURSE_006' THEN '["2026-04-10", "2026-04-11", "2026-04-12", "2026-04-13", "2026-04-14", "2026-04-15", "2026-04-25"]'::jsonb
    WHEN w.worker_code = 'NURSE_007' THEN '["2026-04-05", "2026-04-25", "2026-04-26", "2026-04-27"]'::jsonb
    WHEN w.worker_code = 'NURSE_008' THEN '["2026-04-05", "2026-04-10", "2026-04-11", "2026-04-17", "2026-04-18", "2026-04-25", "2026-04-26"]'::jsonb
    ELSE '[]'::jsonb
  END
FROM worker_ids w
ON CONFLICT (worker_id) DO NOTHING;

-- 2.4 Add Shift Preferences (PREFERRED shifts)
WITH worker_ids AS (
  SELECT id, worker_code FROM maywin_db.workers
  WHERE organization_id = 4
  AND worker_code IN ('NURSE_001', 'NURSE_002', 'NURSE_003', 'NURSE_004', 'NURSE_005', 'NURSE_006', 'NURSE_007', 'NURSE_008')
)
INSERT INTO maywin_db.worker_availability
(worker_id, unit_id, date, shift_code, type, source, reason)
SELECT * FROM (
  -- Nurse 1 preferences (morning only - all 30 days)
  SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-01'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-02'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-03'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-04'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-05'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-06'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-07'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-08'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-09'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-10'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-11'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-12'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-13'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-14'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-15'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-16'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-17'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-18'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-19'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-20'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-21'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-22'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-23'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-24'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-25'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-26'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-27'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-28'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-29'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-30'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Morning only'
  -- Nurse 1: block EVENING and NIGHT on all 30 days (hard "morning only" constraint)
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-01'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-01'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-02'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-02'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-03'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-03'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-04'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-04'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-05'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-05'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-06'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-06'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-07'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-07'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-08'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-08'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-09'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-09'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-10'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-10'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-11'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-11'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-12'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-12'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-13'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-13'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-14'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-14'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-15'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-15'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-16'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-16'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-17'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-17'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-18'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-18'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-19'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-19'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-20'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-20'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-21'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-21'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-22'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-22'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-23'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-23'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-24'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-24'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-25'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-25'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-26'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-26'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-27'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-27'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-28'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-28'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-29'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-29'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-30'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - evening blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-30'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - night blocked'
  UNION ALL
  -- Nurse 3 preferences
  SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-01'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-06'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-20'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-26'::date, 'MORNING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-03'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-17'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-24'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-28'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  -- Nurse 5 preferences
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-02'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-09'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-15'::date, 'EVENING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-24'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-25'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-28'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  -- Nurse 6 preferences
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-04'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  -- Nurse 7 preferences
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-04'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-10'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-24'::date, 'NIGHT', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-28'::date, 'EVENING', 'PREFERRED'::maywin_db.availability_type, 'nurse_request', 'Shift preference'
) AS preferences
ON CONFLICT (worker_id, unit_id, date, shift_code) DO NOTHING;

-- 2.5 Add Day-Off Requests (UNAVAILABLE)
WITH worker_ids AS (
  SELECT id, worker_code FROM maywin_db.workers
  WHERE organization_id = 4
  AND worker_code IN ('NURSE_001', 'NURSE_002', 'NURSE_003', 'NURSE_004', 'NURSE_005', 'NURSE_006', 'NURSE_007', 'NURSE_008')
)
INSERT INTO maywin_db.worker_availability
(worker_id, unit_id, date, shift_code, type, source, reason)
SELECT * FROM (
  -- Nurse 3 days off
  SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-04'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-05'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-18'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-19'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-25'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_003'), 5, '2026-04-29'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  -- Nurse 4 days off
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_004'), 5, '2026-04-04'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_004'), 5, '2026-04-05'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_004'), 5, '2026-04-06'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  -- Nurse 5 days off
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-01'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-10'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-11'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-12'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-13'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-14'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_005'), 5, '2026-04-26'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  -- Nurse 6 days off
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-10'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-11'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-12'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-13'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-14'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-15'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_006'), 5, '2026-04-25'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  -- Nurse 7 days off
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-05'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-25'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-26'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_007'), 5, '2026-04-27'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  -- Nurse 8 days off
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_008'), 5, '2026-04-05'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_008'), 5, '2026-04-10'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_008'), 5, '2026-04-11'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_008'), 5, '2026-04-17'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_008'), 5, '2026-04-18'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_008'), 5, '2026-04-25'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_008'), 5, '2026-04-26'::date, 'ALL', 'DAY_OFF'::maywin_db.availability_type, 'nurse_request', 'Day off'
  -- Nurse 1 unavailable for EVENING and NIGHT every day (morning only)
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-01'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-01'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-02'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-02'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-03'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-03'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-04'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-04'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-05'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-05'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-06'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-06'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-07'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-07'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-08'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-08'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-09'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-09'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-10'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-10'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-11'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-11'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-12'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-12'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-13'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-13'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-14'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-14'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-15'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-15'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-16'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-16'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-17'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-17'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-18'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-18'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-19'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-19'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-20'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-20'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-21'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-21'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-22'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-22'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-23'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-23'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-24'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-24'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-25'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-25'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-26'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-26'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-27'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-27'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-28'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-28'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-29'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-29'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-30'::date, 'EVENING', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - EVENING blocked'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_001'), 5, '2026-04-30'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Morning only - NIGHT blocked'
  -- Nurse 2 unavailable for NIGHT every day
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-01'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-02'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-03'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-04'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-05'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-06'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-07'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-08'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-09'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-10'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-11'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-12'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-13'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-14'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-15'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-16'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-17'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-18'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-19'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-20'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-21'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-22'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-23'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-24'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-25'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-26'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-27'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-28'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-29'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
  UNION ALL SELECT (SELECT id FROM worker_ids WHERE worker_code = 'NURSE_002'), 5, '2026-04-30'::date, 'NIGHT', 'UNAVAILABLE'::maywin_db.availability_type, 'nurse_request', 'Night unavailable'
) AS days_off
ON CONFLICT (worker_id, unit_id, date, shift_code) DO NOTHING;

-- ============================================================================
-- PHASE 3: UPDATE EXISTING DATA (idempotent fixes for re-runs)
-- ============================================================================

-- 3.1 Fix coverage: ensure 2-2-2 staffing for existing rows
UPDATE maywin_db.coverage_rules
SET min_workers = 2
WHERE unit_id = 5 AND shift_code IN ('EVENING', 'NIGHT') AND min_workers < 2;

-- 3.2 Fix worker shift targets: 18 regular shifts, 0 OT for nurse 1, 2 OT for others
UPDATE maywin_db.workers
SET regular_shifts_per_period = 18, max_overtime_shifts = 0
WHERE organization_id = 4 AND worker_code = 'NURSE_001';

UPDATE maywin_db.workers
SET regular_shifts_per_period = 18, max_overtime_shifts = 2
WHERE organization_id = 4 AND worker_code IN ('NURSE_002','NURSE_003','NURSE_004','NURSE_005','NURSE_006','NURSE_007');

-- 3.3 Block Nurse 1 MORNING on weekends (Apr 4,5,11,12,18,19,25,26)
-- Overwrite the PREFERRED entries inserted in section 2.4
UPDATE maywin_db.worker_availability
SET type = 'UNAVAILABLE', reason = 'Morning only - weekend blocked'
WHERE worker_id = (SELECT id FROM maywin_db.workers WHERE organization_id = 4 AND worker_code = 'NURSE_001')
  AND unit_id = 5
  AND shift_code = 'MORNING'
  AND date IN ('2026-04-04','2026-04-05','2026-04-11','2026-04-12',
               '2026-04-18','2026-04-19','2026-04-25','2026-04-26');

COMMIT;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Summary of changes:
-- ✓ Created 3 Shift Templates (Morning, Evening, Night)
-- ✓ Created Coverage Rules (2-2-2 staffing pattern)
-- ✓ Created Constraint Profile with all scheduling rules
-- ✓ Created Schedule Container for April 2026
-- ✓ Inserted 8 Nurses with their details and skills
-- ✓ Added Unit Memberships (all assigned to Unit 5)
-- ✓ Created Worker Preferences with shift preferences and day-off patterns
-- ✓ Added Worker Availability entries for all preferences and day-offs
--
-- The system is now ready for scheduling with the Python solver!
