-- Migration: Add auth_otps and line_link_tokens tables
-- Run this after: psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f src/database/schema/add_2fa_and_line_linking.sql

-- ── auth_otps ─────────────────────────────────────────────────────────────
-- Stores short-lived OTP codes for 2FA email verification
CREATE TABLE IF NOT EXISTS maywin_db.auth_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES maywin_db.users(id) ON DELETE CASCADE,
  otp_code    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_auth_otps_user_id ON maywin_db.auth_otps (user_id);

-- Cleanup expired/used OTPs automatically after 24h (optional, helps keep table small)
-- If you have pg_cron: SELECT cron.schedule('0 * * * *', $$DELETE FROM maywin_db.auth_otps WHERE expires_at < NOW() - INTERVAL '24 hours'$$);

-- ── line_link_tokens ──────────────────────────────────────────────────────
-- One-time invite codes for nurses to link their LINE account to a Worker record
CREATE TABLE IF NOT EXISTS maywin_db.line_link_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   BIGINT NOT NULL REFERENCES maywin_db.workers(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,     -- e.g. "A3X9K2" — 6-char uppercase alphanumeric
  expires_at  TIMESTAMPTZ NOT NULL,     -- 48 hours from generation
  used_at     TIMESTAMPTZ,              -- NULL = unused / available
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_line_link_tokens_worker_id ON maywin_db.line_link_tokens (worker_id);
