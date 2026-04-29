-- Fix 1: Update preference_pattern_json — replace all 2026-07-XX keys with 2026-05-XX
-- This fixes the display in the Requests tab (currently showing 0 because dates are July)
-- Preserves any April or other non-July entries untouched

UPDATE maywin_db.worker_preferences
SET preference_pattern_json = (
  SELECT jsonb_object_agg(
    CASE WHEN key LIKE '2026-07-%'
      THEN replace(key, '2026-07-', '2026-05-')
      ELSE key
    END,
    value
  )
  FROM jsonb_each(preference_pattern_json)
)
WHERE worker_id IN (70, 71, 72, 73, 74, 75, 76)
  AND preference_pattern_json::text LIKE '%2026-07-%';

-- Fix 2: Remove soft PREFERRED/AVOID rows added by the preferences seed
-- The hard UNAVAILABLE/DAY_OFF rows from seed_may2026_availability.sql remain

DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND worker_id IN (70, 71, 72, 73, 74, 75, 76, 176)
  AND date BETWEEN '2026-05-01' AND '2026-05-31'
  AND type IN ('PREFERRED', 'AVOID');
