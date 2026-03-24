-- ============================================================================
-- PATCH: Clean up stale preferences + deduplicate coverage rules (Unit 5)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Remove ALL 2025-04 keys from NURSE_001 preference_pattern_json
-- ============================================================================
-- The preferences got merged with old 2025 keys ({"NIGHT":5} only, missing
-- EVENING). Replace the whole json with the clean 2026-only version.

UPDATE maywin_db.worker_preferences
SET preference_pattern_json = '{
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
  SELECT id FROM maywin_db.workers
  WHERE organization_id = 4 AND worker_code = 'NURSE_001'
);

-- ============================================================================
-- STEP 2: Deduplicate coverage_rules for unit 5
-- ============================================================================
-- The setup SQL ran multiple times producing 30 rows instead of 6.
-- Keep only the row with the highest id per (unit_id, shift_code, day_type).

DELETE FROM maywin_db.coverage_rules
WHERE unit_id = 5
  AND id NOT IN (
    SELECT MAX(id)
    FROM maywin_db.coverage_rules
    WHERE unit_id = 5
    GROUP BY shift_code, day_type
  );

-- Verify exactly 6 rows remain
DO $$
DECLARE cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt FROM maywin_db.coverage_rules WHERE unit_id = 5;
  IF cnt != 6 THEN
    RAISE EXCEPTION 'Expected 6 coverage_rules for unit 5, got %', cnt;
  END IF;
END $$;

COMMIT;
