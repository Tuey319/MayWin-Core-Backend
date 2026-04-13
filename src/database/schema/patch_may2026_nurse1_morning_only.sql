-- ============================================================
-- PATCH: Restrict Nurse #1 (worker_id=69, NURSE_001) to
--        MORNING-only shifts for May 2026 (schedule_id=41).
--
-- How it works:
--   The solver adapter treats UNAVAILABLE rows as availability=0.
--   Inserting UNAVAILABLE for EVENING and NIGHT on every May date
--   forces the solver to only consider MORNING for this nurse.
--
--   Off days (11 days: all Sat/Sun + May 4) get ALL shifts blocked
--   via shift_code='ALL' (handled by the adapter).
--
-- Worker: id=69, worker_code=NURSE_001, unit_id=5, organization_id=4
-- ============================================================

BEGIN;

-- Step 1: Block EVENING and NIGHT for all 31 May days (working days)
--         Uses ON CONFLICT to be safe if rows already exist.
INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason, created_at)
SELECT
  69,
  5,
  d::date,
  s,
  'UNAVAILABLE',
  'MANAGER',
  'Nurse #1 is MORNING-shift only (special role)',
  NOW()
FROM
  generate_series('2026-05-01'::date, '2026-05-31'::date, '1 day'::interval) AS d,
  (VALUES ('EVENING'), ('NIGHT')) AS shifts(s)
-- Skip off days (Sat/Sun/May 4) — those are handled by Step 2
WHERE EXTRACT(DOW FROM d::date) NOT IN (0, 6)   -- 0=Sun, 6=Sat
  AND d::date != '2026-05-04'
ON CONFLICT (worker_id, unit_id, date, shift_code)
  DO UPDATE SET type = 'UNAVAILABLE', source = 'MANAGER',
                reason = 'Nurse #1 is MORNING-shift only (special role)';

-- Step 2: Block ALL shifts on the 11 off days
--         (solver adapter expands shift_code='ALL' to every shift)
INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason, created_at)
SELECT
  69,
  5,
  d::date,
  'ALL',
  'DAY_OFF',
  'MANAGER',
  'Fixed day off: weekend or public holiday (May 4)',
  NOW()
FROM
  generate_series('2026-05-01'::date, '2026-05-31'::date, '1 day'::interval) AS d
WHERE EXTRACT(DOW FROM d::date) IN (0, 6)   -- Sat or Sun
   OR d::date = '2026-05-04'               -- public holiday
ON CONFLICT (worker_id, unit_id, date, shift_code)
  DO UPDATE SET type = 'DAY_OFF', source = 'MANAGER',
                reason = 'Fixed day off: weekend or public holiday (May 4)';

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================

-- Should show 20 rows of UNAVAILABLE EVENING + 20 UNAVAILABLE NIGHT
-- (20 working days), plus 11 DAY_OFF ALL rows
SELECT date::text, shift_code, type
FROM maywin_db.worker_availability
WHERE worker_id = 69
  AND unit_id = 5
  AND date BETWEEN '2026-05-01' AND '2026-05-31'
ORDER BY date, shift_code;

-- Summary: should be 40 UNAVAILABLE + 11 DAY_OFF = 51 total rows
SELECT type, COUNT(*) AS row_count
FROM maywin_db.worker_availability
WHERE worker_id = 69
  AND unit_id = 5
  AND date BETWEEN '2026-05-01' AND '2026-05-31'
GROUP BY type;
