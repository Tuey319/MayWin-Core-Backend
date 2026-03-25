-- ============================================================
-- April 2026 – Ward 3A Nurse Config (safe version, no hardcoded IDs)
-- Run via pgAdmin4 against maywin-restored RDS
-- ============================================================

-- Preview: show workers in unit 5 first
SELECT w.id, w.full_name, w.worker_code, w.regular_shifts_per_period, w.max_overtime_shifts, w.min_shifts_per_period
FROM maywin_db.workers w
JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
WHERE wum.unit_id = 5
  AND w.is_active = true
ORDER BY w.id;

-- ============================================================
-- 1. Set shift limits on all nurses in unit 5
--    18 regular + up to 5 OT
--    Why 5? Demand = 2 nurses × 3 shifts × 30 days = 180 slots.
--    8 nurses × 18 regular = 144 (36 short). Need 36 OT total.
--    36 OT / 8 nurses = 4.5 avg → cap of 5 gives headroom (max 184 capacity).
--    Nurses absorbing OT will work 22-23 days (7-8 days off instead of 12).
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
-- 2. Clear any existing DAY_OFF on Apr 6/13/14/15 for ALL
--    nurses in unit 5 (reset before re-inserting)
-- ============================================================
DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND date IN (
      '2026-04-06',
      '2026-04-13',
      '2026-04-14',
      '2026-04-15'
  )
  AND worker_id IN (
      SELECT DISTINCT w.id
      FROM maywin_db.workers w
      JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
      WHERE wum.unit_id = 5 AND w.is_active = true
  );

-- ============================================================
-- 3. Insert DAY_OFF on Apr 6/13/14/15 for NURSE 1 ONLY
--    (the nurse with the lowest worker_id in unit 5)
--    Other nurses remain available to cover the 2-per-shift need.
-- ============================================================
INSERT INTO maywin_db.worker_availability
    (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
SELECT
    nurse1.id,
    5,
    d.day_off_date,
    'ALL',
    'DAY_OFF',
    'personal_leave',
    'Nurse 1 personal days off – Apr 6, 13, 14, 15',
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
-- 4a. Remove NURSE 2's night shift restriction (she can now
--     work night shifts as of the updated schedule)
-- ============================================================
DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND shift_code = 'NIGHT'
  AND type = 'UNAVAILABLE'
  AND date BETWEEN '2026-04-01' AND '2026-04-30'
  AND worker_id = (
      SELECT w.id
      FROM maywin_db.workers w
      JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
      WHERE wum.unit_id = 5 AND w.is_active = true
      ORDER BY w.id
      LIMIT 1 OFFSET 1
  );

-- ============================================================
-- 4b. Block NURSE 1 from EVENING and NIGHT shifts (morning only)
--     (the nurse with the lowest worker_id in unit 5)
-- ============================================================
DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND shift_code IN ('EVENING', 'NIGHT')
  AND type = 'UNAVAILABLE'
  AND date BETWEEN '2026-04-01' AND '2026-04-30'
  AND worker_id = (
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
    'Nurse 1 morning-only – cannot work evening or night shifts',
    '{}'::jsonb
FROM (
    SELECT w.id
    FROM maywin_db.workers w
    JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
    WHERE wum.unit_id = 5 AND w.is_active = true
    ORDER BY w.id
    LIMIT 1
) AS nurse1,
(SELECT generate_series('2026-04-01'::date, '2026-04-30'::date, '1 day'::interval) AS shift_date) AS d,
(VALUES ('EVENING'), ('NIGHT')) AS sc(code)
ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
    type   = 'UNAVAILABLE',
    source = 'shift_restriction',
    reason = EXCLUDED.reason;

-- ============================================================
-- 5. Ensure max_shifts_per_day = 1 for unit 5
--    The schedule_assignments table has a UNIQUE constraint on
--    (schedule_run_id, worker_id, date) — only one shift per
--    nurse per day is supported by the schema.
--    Overtime is expressed as extra working days beyond the
--    18-shift regular baseline (tracked via over[n] in solver).
-- ============================================================
UPDATE maywin_db.constraint_profiles
SET
    max_shifts_per_day = 1
WHERE unit_id = 5
  AND is_active = true;

-- ============================================================
-- 6. Verify
--    - All nurses: should show 18/5/18
--    - DAY_OFF rows: should be exactly 4 rows (nurse 1 × 4 days)
--    - Nurse 1 shift blocks: should be exactly 60 rows (1 nurse × 30 days × 2 shifts)
--    - Nurse 2 NIGHT blocks: should be 0 rows (restriction removed)
--    - Constraint profile: max_shifts_per_day should be 1
-- ============================================================
SELECT w.id, w.full_name, w.regular_shifts_per_period, w.max_overtime_shifts, w.min_shifts_per_period
FROM maywin_db.workers w
JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
WHERE wum.unit_id = 5 AND w.is_active = true
ORDER BY w.id;

SELECT worker_id, date::text, shift_code, type, reason
FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND date IN ('2026-04-06','2026-04-13','2026-04-14','2026-04-15')
ORDER BY worker_id, date;

SELECT COUNT(*) AS nurse1_shift_blocks
FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND shift_code IN ('EVENING', 'NIGHT')
  AND type = 'UNAVAILABLE'
  AND date BETWEEN '2026-04-01' AND '2026-04-30';

SELECT COUNT(*) AS nurse2_night_blocks
FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND shift_code = 'NIGHT'
  AND type = 'UNAVAILABLE'
  AND date BETWEEN '2026-04-01' AND '2026-04-30'
  AND worker_id = (
      SELECT w.id FROM maywin_db.workers w
      JOIN maywin_db.worker_unit_memberships wum ON wum.worker_id = w.id
      WHERE wum.unit_id = 5 AND w.is_active = true ORDER BY w.id LIMIT 1 OFFSET 1
  );

SELECT id, unit_id, max_shifts_per_day, min_days_off_per_week, forbid_evening_to_night
FROM maywin_db.constraint_profiles
WHERE unit_id = 5 AND is_active = true;
