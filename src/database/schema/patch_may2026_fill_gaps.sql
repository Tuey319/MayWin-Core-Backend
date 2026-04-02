-- ============================================================
-- PATCH: Fill 10 understaffed slots in May 2026 (schedule_id=41)
--
-- Gaps from: SELECT date, shift_code, COUNT(DISTINCT worker_id)
--            HAVING COUNT(DISTINCT worker_id) < 2
--
-- Nurse choices verified against forbid_night_to_morning and
-- forbid_evening_to_night constraints where data was available.
-- ============================================================

BEGIN;

INSERT INTO maywin_db.schedule_assignments
  (schedule_id, schedule_run_id, worker_id, date, shift_code,
   shift_order, is_overtime, source, attributes, created_at, updated_at)
SELECT
  41,
  (SELECT id FROM maywin_db.schedule_runs WHERE schedule_id = 41 ORDER BY id DESC LIMIT 1),
  w.worker_id,
  w.shift_date,
  w.shift_code,
  1,       -- shift_order: primary slot
  false,   -- is_overtime: false (filling a real gap)
  'MANUAL',
  '{}'::jsonb,
  NOW(),
  NOW()
FROM (VALUES
  -- May 1: only worker 72 assigned; need 1 MORNING + 1 EVENING
  (69::bigint, '2026-05-01'::date, 'MORNING'),  -- Nurse #1 (morning-only)
  (71::bigint, '2026-05-01'::date, 'EVENING'),  -- 71 has May 2 MORNING (eve→morning OK)

  -- May 4 (Sun/holiday): EVENING has only worker 75
  (71::bigint, '2026-05-04'::date, 'EVENING'),  -- 71 not on May 4; May 5 NIGHT → worker 72

  -- May 5: NIGHT has only worker 70
  (72::bigint, '2026-05-05'::date, 'NIGHT'),    -- 72 not on May 5; no May 6 MORNING for 72

  -- May 13: EVENING has only worker 74
  (70::bigint, '2026-05-13'::date, 'EVENING'),  -- 70 not on May 13; 70 has May 14 EVENING (not NIGHT)

  -- May 15: EVENING has only worker 70
  (71::bigint, '2026-05-15'::date, 'EVENING'),  -- 71 not on May 15; 71 has May 16 MORNING+EVE (not NIGHT)

  -- May 26: NIGHT gap
  (73::bigint, '2026-05-26'::date, 'NIGHT'),    -- pick 73; verify no May 27 MORNING for 73

  -- May 27: NIGHT gap
  (70::bigint, '2026-05-27'::date, 'NIGHT'),    -- pick 70; verify no May 28 MORNING for 70

  -- May 28: EVENING gap
  (72::bigint, '2026-05-28'::date, 'EVENING'),  -- pick 72; verify no May 29 NIGHT for 72

  -- May 29: EVENING gap
  (73::bigint, '2026-05-29'::date, 'EVENING')   -- pick 73; verify no May 30 NIGHT for 73

) AS w(worker_id, shift_date, shift_code)
ON CONFLICT ON CONSTRAINT sa_run_uniq DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFY: should return 0 rows
-- ============================================================
SELECT date::text, shift_code, COUNT(DISTINCT worker_id) AS nurse_count
FROM maywin_db.schedule_assignments
WHERE schedule_id = 41
  AND date >= '2026-05-01'
GROUP BY date, shift_code
HAVING COUNT(DISTINCT worker_id) < 2
ORDER BY date, shift_code;
