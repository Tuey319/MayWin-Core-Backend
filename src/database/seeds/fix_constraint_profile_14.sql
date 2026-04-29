-- Ensure constraint profile 14 has:
--   ignoreAvailabilityInEmergency = true  (already set via API, confirming)
--   time_limit_sec = 120                  (was 20 — solver needs more time for emergency search)
--   max_shifts_per_day = 2               (OT enabled)

UPDATE maywin_db.constraint_profiles
SET
  ignore_availability_in_emergency = true,
  time_limit_sec                   = 120,
  max_shifts_per_day               = 2
WHERE id = 14;

-- Verify
SELECT
  id,
  ignore_availability_in_emergency,
  allow_emergency_overrides,
  guarantee_full_coverage,
  time_limit_sec,
  max_shifts_per_day,
  max_nights_per_week,
  attributes->>'minTotalDaysOff'      AS min_total_days_off,
  attributes->>'enableMinTotalDaysOff' AS enable_min_total_days_off
FROM maywin_db.constraint_profiles
WHERE id = 14;
