-- ============================================================
-- SEED: boon_final.json → MayWin DB
-- Source: data/boon_final.json
--
-- Creates everything needed to run the solver for May 2026:
--   org → unit → workers → shift templates → coverage rules
--   → constraint profile → schedule → availability (N1)
--
-- Run with: psql $DATABASE_URL -f data/seed_boon_final.sql
-- After running, note the printed Schedule ID and use it with:
--   POST /orchestrator/run  { "scheduleId": "<id>", "dto": { "startDate": "2026-05-01", "endDate": "2026-05-31" } }
-- ============================================================

DO $$
DECLARE
  v_org_id   bigint;
  v_unit_id  bigint;
  v_cp_id    bigint;
  v_sched_id bigint;
  v_n1 bigint; v_n2 bigint; v_n3 bigint; v_n4 bigint;
  v_n5 bigint; v_n6 bigint; v_n7 bigint; v_n8 bigint;
BEGIN

  -- ── 1. Organization ──────────────────────────────────────────────────────────
  INSERT INTO maywin_db.organizations (name, code, timezone, attributes)
  VALUES ('Boon Hospital', 'boon', 'Asia/Bangkok', '{}')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

  SELECT id INTO v_org_id FROM maywin_db.organizations WHERE code = 'boon';

  -- ── 2. Unit ──────────────────────────────────────────────────────────────────
  INSERT INTO maywin_db.units (organization_id, name, code, attributes, is_active)
  VALUES (v_org_id, 'Ward A', 'WARD_A', '{}', true)
  ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name;

  SELECT id INTO v_unit_id FROM maywin_db.units
  WHERE organization_id = v_org_id AND code = 'WARD_A';

  -- ── 3. Shift templates (unit-scoped) ─────────────────────────────────────────
  -- morning: 07:00-15:00 | evening: 15:00-23:00 | night: 23:00-07:00
  INSERT INTO maywin_db.shift_templates
    (organization_id, unit_id, code, name, start_time, end_time, attributes, is_active)
  VALUES
    (v_org_id, v_unit_id, 'morning', 'Morning', '07:00:00', '15:00:00', '{}', true),
    (v_org_id, v_unit_id, 'evening', 'Evening', '15:00:00', '23:00:00', '{}', true),
    (v_org_id, v_unit_id, 'night',   'Night',   '23:00:00', '07:00:00', '{}', true)
  ON CONFLICT (organization_id, unit_id, code) DO NOTHING;

  -- ── 4. Workers N1–N8 ─────────────────────────────────────────────────────────
  -- regular_shifts_per_period=20, max_overtime_shifts=8 (from boon_final.json)
  INSERT INTO maywin_db.workers
    (organization_id, primary_unit_id, full_name, worker_code,
     employment_type, is_active, is_backup_worker,
     regular_shifts_per_period, max_overtime_shifts, attributes)
  VALUES
    (v_org_id, v_unit_id, 'Nurse 1', 'N1', 'FULL_TIME', true, false, 20, 8, '{}'),
    (v_org_id, v_unit_id, 'Nurse 2', 'N2', 'FULL_TIME', true, false, 20, 8, '{}'),
    (v_org_id, v_unit_id, 'Nurse 3', 'N3', 'FULL_TIME', true, false, 20, 8, '{}'),
    (v_org_id, v_unit_id, 'Nurse 4', 'N4', 'FULL_TIME', true, false, 20, 8, '{}'),
    (v_org_id, v_unit_id, 'Nurse 5', 'N5', 'FULL_TIME', true, false, 20, 8, '{}'),
    (v_org_id, v_unit_id, 'Nurse 6', 'N6', 'FULL_TIME', true, false, 20, 8, '{}'),
    (v_org_id, v_unit_id, 'Nurse 7', 'N7', 'FULL_TIME', true, false, 20, 8, '{}'),
    (v_org_id, v_unit_id, 'Nurse 8', 'N8', 'FULL_TIME', true, false, 20, 8, '{}')
  ON CONFLICT (organization_id, worker_code) DO NOTHING;

  SELECT id INTO v_n1 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N1';
  SELECT id INTO v_n2 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N2';
  SELECT id INTO v_n3 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N3';
  SELECT id INTO v_n4 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N4';
  SELECT id INTO v_n5 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N5';
  SELECT id INTO v_n6 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N6';
  SELECT id INTO v_n7 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N7';
  SELECT id INTO v_n8 FROM maywin_db.workers WHERE organization_id = v_org_id AND worker_code = 'N8';

  -- ── 5. Worker → unit memberships ─────────────────────────────────────────────
  INSERT INTO maywin_db.worker_unit_memberships (worker_id, unit_id, role_code)
  VALUES
    (v_n1, v_unit_id, 'NURSE'),
    (v_n2, v_unit_id, 'NURSE'),
    (v_n3, v_unit_id, 'NURSE'),
    (v_n4, v_unit_id, 'NURSE'),
    (v_n5, v_unit_id, 'NURSE'),
    (v_n6, v_unit_id, 'NURSE'),
    (v_n7, v_unit_id, 'NURSE'),
    (v_n8, v_unit_id, 'NURSE')
  ON CONFLICT (worker_id, unit_id) DO NOTHING;

  -- ── 6. Coverage rules ────────────────────────────────────────────────────────
  -- demand from boon_final.json: 2 per shift, every day (WEEKDAY + WEEKEND identical)
  INSERT INTO maywin_db.coverage_rules (unit_id, shift_code, day_type, min_workers, max_workers, attributes)
  VALUES
    (v_unit_id, 'morning', 'WEEKDAY', 2, 2, '{}'),
    (v_unit_id, 'evening', 'WEEKDAY', 2, 2, '{}'),
    (v_unit_id, 'night',   'WEEKDAY', 2, 2, '{}'),
    (v_unit_id, 'morning', 'WEEKEND', 2, 2, '{}'),
    (v_unit_id, 'evening', 'WEEKEND', 2, 2, '{}'),
    (v_unit_id, 'night',   'WEEKEND', 2, 2, '{}');

  -- ── 7. Constraint profile ─────────────────────────────────────────────────────
  -- Maps every field from boon_final.json rules/weights/fairness_weights.
  -- Advanced keys (enable_shift_type_limit, shiftTypeLimitExemptNurses, etc.)
  -- live in attributes so the normalizer's readAttr() helper picks them up.
  INSERT INTO maywin_db.constraint_profiles (
    unit_id, org_id, name, description,
    -- coverage / emergency
    guarantee_full_coverage, allow_emergency_overrides,
    allow_second_shift_same_day_in_emergency, ignore_availability_in_emergency,
    allow_night_cap_override_in_emergency, allow_rest_rule_override_in_emergency,
    -- daily / weekly limits
    max_shifts_per_day, min_days_off_per_week, max_nights_per_week,
    -- shift-sequence toggles
    forbid_night_to_morning, forbid_morning_to_night_same_day, forbid_evening_to_night,
    -- goal toggles
    goal_minimize_staff_cost, goal_maximize_preference_satisfaction,
    goal_balance_workload, goal_balance_night_workload, goal_reduce_undesirable_shifts,
    -- objective / fairness / priority JSON
    penalty_weight_json, fairness_weight_json, goal_priority_json,
    -- solver tuning
    num_search_workers, time_limit_sec,
    is_active,
    -- advanced knobs (read by normalizer via readAttr)
    attributes
  )
  VALUES (
    v_unit_id, v_org_id, 'Boon Default', 'Seeded from boon_final.json',
    -- coverage / emergency
    true,  true,
    true,  false,
    true,  true,
    -- daily / weekly (rules.max_shifts_per_day=2, min_days_off_per_week=1, max_nights_per_week=7)
    2, 1, 7,
    -- shift-sequence (keep safe defaults)
    true, false, true,
    -- goals
    true, true,
    true, true, true,
    -- weights from boon_final.json "weights"
    '{"understaff_penalty":100000000,"overtime_penalty":5,"preference_penalty_multiplier":1,
      "workload_balance_weight":40,"emergency_override_penalty":50,
      "same_day_second_shift_penalty":20}'::jsonb,
    -- fairness_weights from boon_final.json
    '{"workload_balance":1,"night_balance":1,"shift_type_balance":0}'::jsonb,
    -- goal_priority (standard ordering)
    '{"coverage":1,"cost":2,"preference":3,"fairness":4}'::jsonb,
    -- solver tuning
    8, 60,
    true,
    -- advanced attributes: enable_shift_type_limit, max_shift_per_type,
    --   shiftTypeLimitExemptNurses (N1 exempt), enable_min_total_days_off, min_total_days_off
    '{
      "enableShiftTypeLimit": true,
      "maxShiftPerType": {"morning": 9, "evening": 9, "night": 9},
      "shiftTypeLimitExemptNurses": ["N1"],
      "enableMinTotalDaysOff": true,
      "minTotalDaysOff": 11
    }'::jsonb
  )
  RETURNING id INTO v_cp_id;

  -- ── 8. Schedule (May 2026) ───────────────────────────────────────────────────
  INSERT INTO maywin_db.schedules (
    organization_id, unit_id, name,
    start_date, end_date,
    status, constraint_profile_id,
    created_by, attributes
  )
  VALUES (
    v_org_id, v_unit_id, 'May 2026 – Boon Ward A',
    '2026-05-01', '2026-05-31',
    'DRAFT', v_cp_id,
    1, '{}'
  )
  RETURNING id INTO v_sched_id;

  -- ── 9. Worker availability – N1 only ─────────────────────────────────────────
  -- boon_final.json availability["N1"]: 0=unavailable, 1=available
  --
  -- Pattern for N1:
  --   Completely off (all shifts = 0):
  --     May 2,3,4  (Sat/Sun + Mon from week boundary)
  --     May 9,10   May 16,17   May 23,24   May 30,31
  --   Morning-only (morning=1, evening=0, night=0):
  --     all other days in May (1,5–8,11–15,18–22,25–29)

  -- Fully off days → single DAY_OFF row with shift_code='ALL'
  -- The adapter expands 'ALL' to block every shift on that day.
  INSERT INTO maywin_db.worker_availability
    (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
  SELECT v_n1, v_unit_id, d::date, 'ALL', 'DAY_OFF', 'MANUAL', 'Seeded day off', '{}'
  FROM unnest(ARRAY[
    '2026-05-02','2026-05-03','2026-05-04',
    '2026-05-09','2026-05-10',
    '2026-05-16','2026-05-17',
    '2026-05-23','2026-05-24',
    '2026-05-30','2026-05-31'
  ]::date[]) AS d
  ON CONFLICT (worker_id, unit_id, date, shift_code) DO NOTHING;

  -- Morning-only days → UNAVAILABLE for evening and night
  INSERT INTO maywin_db.worker_availability
    (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
  SELECT v_n1, v_unit_id, d::date, shift, 'UNAVAILABLE', 'MANUAL', 'Morning only', '{}'
  FROM unnest(ARRAY[
    '2026-05-01','2026-05-05','2026-05-06','2026-05-07','2026-05-08',
    '2026-05-11','2026-05-12','2026-05-13','2026-05-14','2026-05-15',
    '2026-05-18','2026-05-19','2026-05-20','2026-05-21','2026-05-22',
    '2026-05-25','2026-05-26','2026-05-27','2026-05-28','2026-05-29'
  ]::date[]) AS d
  CROSS JOIN unnest(ARRAY['evening','night']) AS shift
  ON CONFLICT (worker_id, unit_id, date, shift_code) DO NOTHING;

  -- ── Done ─────────────────────────────────────────────────────────────────────
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Seed complete.';
  RAISE NOTICE '  org_id      = %', v_org_id;
  RAISE NOTICE '  unit_id     = %', v_unit_id;
  RAISE NOTICE '  profile_id  = %', v_cp_id;
  RAISE NOTICE '  schedule_id = %  ← use this below', v_sched_id;
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Run the solver:';
  RAISE NOTICE '  POST /orchestrator/run';
  RAISE NOTICE '  { "scheduleId": "%", "dto": { "startDate": "2026-05-01", "endDate": "2026-05-31" } }', v_sched_id;

END;
$$;
