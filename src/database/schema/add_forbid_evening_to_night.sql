-- Migration: add forbid_evening_to_night to constraint_profiles
-- Prevents scheduling Evening (16:00-24:00) on day N followed by Night (00:00-08:00) on day N+1
-- which results in 0 hours of rest between shifts.

ALTER TABLE maywin_db.constraint_profiles
  ADD COLUMN IF NOT EXISTS forbid_evening_to_night boolean NOT NULL DEFAULT true;

-- Enable the constraint on all existing profiles
UPDATE maywin_db.constraint_profiles
  SET forbid_evening_to_night = true
  WHERE forbid_evening_to_night IS DISTINCT FROM true;
