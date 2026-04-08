-- =============================================================================
-- MayWin Nurse Scheduling Platform — Complete Database Schema
-- Version: final (solver v3 / app3.py)
-- Schema:  maywin_db
-- Engine:  PostgreSQL 14+
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bootstrap
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS maywin_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SET search_path TO maywin_db, public;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

-- Conversation state for LINE chatbot
DO $$ BEGIN
  CREATE TYPE maywin_db.conversation_state AS ENUM (
    'IDLE',
    'AWAITING_CONFIRMATION',
    'PROCESSING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Worker availability entry type
DO $$ BEGIN
  CREATE TYPE maywin_db.availability_type AS ENUM (
    'AVAILABLE',
    'UNAVAILABLE',
    'PREFERRED',
    'AVOID',
    'DAY_OFF'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Worker employment contract type
DO $$ BEGIN
  CREATE TYPE maywin_db.employment_type AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'TEMP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Schedule lifecycle status
DO $$ BEGIN
  CREATE TYPE maywin_db.schedule_status AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Solver job pipeline status
DO $$ BEGIN
  CREATE TYPE maywin_db.schedule_job_status AS ENUM (
    'REQUESTED',
    'VALIDATED',
    'NORMALIZING',
    'SOLVING_A_STRICT',
    'SOLVING_A_RELAXED',
    'SOLVING_B_MILP',
    'EVALUATING',
    'PERSISTING',
    'COMPLETED',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Solver plan strategy
DO $$ BEGIN
  CREATE TYPE maywin_db.solver_plan AS ENUM (
    'A_STRICT',
    'A_RELAXED',
    'B_MILP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Solver run lifecycle status
DO $$ BEGIN
  CREATE TYPE maywin_db.solver_run_status AS ENUM (
    'QUEUED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Schedule artifact type
DO $$ BEGIN
  CREATE TYPE maywin_db.schedule_artifact_type AS ENUM (
    'NORMALIZED_INPUT',
    'SOLVER_OUTPUT',
    'EVALUATION_REPORT',
    'FINAL_SCHEDULE_EXPORT',
    'KPI_SUMMARY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LINE message direction
DO $$ BEGIN
  CREATE TYPE maywin_db.message_direction AS ENUM (
    'INBOUND',
    'OUTBOUND'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LINE message delivery status
DO $$ BEGIN
  CREATE TYPE maywin_db.message_status AS ENUM (
    'SENT',
    'DELIVERED',
    'READ',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- SECTION 1 — CORE (multi-tenancy hierarchy)
-- =============================================================================

-- organizations
-- Top-level tenant. Every other entity ultimately belongs to one organization.
CREATE TABLE IF NOT EXISTS maywin_db.organizations (
  id          bigserial     PRIMARY KEY,
  name        text          NOT NULL,
  code        text          NOT NULL UNIQUE,
  timezone    text          NOT NULL DEFAULT 'Asia/Bangkok',
  attributes  jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

-- sites
-- Physical locations (hospitals, clinics) within an organization.
CREATE TABLE IF NOT EXISTS maywin_db.sites (
  id              bigserial   PRIMARY KEY,
  organization_id bigint      NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  code            text        NOT NULL,
  address         text,
  timezone        text,
  attributes      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sites_org_code_uniq UNIQUE (organization_id, code)
);

-- units
-- Clinical units / departments (e.g. ICU, Ward A) within a site.
CREATE TABLE IF NOT EXISTS maywin_db.units (
  id              bigserial   PRIMARY KEY,
  organization_id bigint      NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  site_id         bigint      REFERENCES maywin_db.sites(id) ON DELETE SET NULL,
  name            text        NOT NULL,
  code            text        NOT NULL,
  description     text,
  attributes      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_org_code_uniq UNIQUE (organization_id, code)
);

-- =============================================================================
-- SECTION 2 — USERS & AUTH
-- =============================================================================

-- roles
-- Permission roles (e.g. ADMIN, SCHEDULER, NURSE).
CREATE TABLE IF NOT EXISTS maywin_db.roles (
  id          bigserial   PRIMARY KEY,
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- users
-- Web-app accounts. One per email address, scoped to one organization.
CREATE TABLE IF NOT EXISTS maywin_db.users (
  id              bigserial   PRIMARY KEY,
  organization_id bigint      NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  email           text        NOT NULL UNIQUE,
  password_hash   text        NOT NULL,
  full_name       text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  attributes      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_users_org ON maywin_db.users (organization_id);

-- user_roles
-- Junction: user ↔ role (many-to-many).
CREATE TABLE IF NOT EXISTS maywin_db.user_roles (
  user_id bigint NOT NULL REFERENCES maywin_db.users(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES maywin_db.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS maywin_db.user_profiles (
  id                 bigserial   PRIMARY KEY,
  user_id            bigint      NOT NULL UNIQUE REFERENCES maywin_db.users(id) ON DELETE CASCADE,
  avatar_data        text,
  avatar_bucket      text,
  avatar_key         text,
  avatar_content_type text,
  avatar_updated_at  timestamptz,
  bio                text,
  phone_number       text,
  metadata           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_profiles_user_id ON maywin_db.user_profiles (user_id);

-- unit_memberships
-- Which users belong to which unit and in what capacity.
CREATE TABLE IF NOT EXISTS maywin_db.unit_memberships (
  id          bigserial   PRIMARY KEY,
  unit_id     bigint      NOT NULL REFERENCES maywin_db.units(id) ON DELETE CASCADE,
  user_id     bigint      NOT NULL REFERENCES maywin_db.users(id) ON DELETE CASCADE,
  role_code   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT um_unit_user_uniq UNIQUE (unit_id, user_id)
);

-- auth_otps
-- Short-lived 6-digit OTP tokens for 2FA / password reset.
CREATE TABLE IF NOT EXISTS maywin_db.auth_otps (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    bigint      NOT NULL REFERENCES maywin_db.users(id) ON DELETE CASCADE,
  otp_code   text        NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_auth_otps_user_id ON maywin_db.auth_otps (user_id);

-- =============================================================================
-- SECTION 3 — WORKERS (nurses / staff)
-- =============================================================================

-- workers
-- A nurse or other staff member. Can be linked to a web user account.
CREATE TABLE IF NOT EXISTS maywin_db.workers (
  id                      bigserial                    PRIMARY KEY,
  organization_id         bigint                       NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  primary_unit_id         bigint                       REFERENCES maywin_db.units(id) ON DELETE SET NULL,
  full_name               text                         NOT NULL,
  worker_code             text,
  employment_type         maywin_db.employment_type,
  weekly_hours            int,
  -- solver v3: scheduling role flags
  is_backup_worker        boolean                      NOT NULL DEFAULT false,
  max_overtime_shifts     int,                         -- max overtime shifts per scheduling period
  regular_shifts_per_period int,                       -- target regular (non-overtime) shifts per period
  min_shifts_per_period   int,                         -- minimum guaranteed shifts per period
  -- integrations
  linked_user_id          bigint                       REFERENCES maywin_db.users(id) ON DELETE SET NULL,
  line_id                 text                         UNIQUE,
  -- meta
  is_active               boolean                      NOT NULL DEFAULT true,
  attributes              jsonb                        NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz                  NOT NULL DEFAULT now(),
  updated_at              timestamptz                  NOT NULL DEFAULT now(),
  CONSTRAINT workers_org_code_uniq UNIQUE (organization_id, worker_code)
);

CREATE INDEX IF NOT EXISTS ix_workers_org       ON maywin_db.workers (organization_id);
CREATE INDEX IF NOT EXISTS ix_workers_unit      ON maywin_db.workers (primary_unit_id) WHERE primary_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_workers_line_id   ON maywin_db.workers (line_id)         WHERE line_id IS NOT NULL;

-- worker_unit_memberships
-- Many-to-many: workers ↔ units (a nurse can float across units).
CREATE TABLE IF NOT EXISTS maywin_db.worker_unit_memberships (
  worker_id bigint NOT NULL REFERENCES maywin_db.workers(id) ON DELETE CASCADE,
  unit_id   bigint NOT NULL REFERENCES maywin_db.units(id)   ON DELETE CASCADE,
  role_code text,
  PRIMARY KEY (worker_id, unit_id)
);

-- worker_availability
-- Shift-level availability / preference entries submitted by or on behalf of nurses.
-- type: AVAILABLE | UNAVAILABLE | PREFERRED | AVOID | DAY_OFF
CREATE TABLE IF NOT EXISTS maywin_db.worker_availability (
  id         bigserial                    PRIMARY KEY,
  worker_id  bigint                       NOT NULL REFERENCES maywin_db.workers(id) ON DELETE CASCADE,
  unit_id    bigint                       NOT NULL REFERENCES maywin_db.units(id) ON DELETE CASCADE,
  date       date                         NOT NULL,
  shift_code text                         NOT NULL,
  type       maywin_db.availability_type  NOT NULL,
  source     text                         NOT NULL,   -- e.g. 'SELF', 'MANAGER', 'LINE_BOT'
  reason     text,
  attributes jsonb                        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz                  NOT NULL DEFAULT now(),
  CONSTRAINT wa_uniq UNIQUE (worker_id, unit_id, date, shift_code)
);

CREATE INDEX IF NOT EXISTS ix_worker_availability_unit_date
  ON maywin_db.worker_availability (unit_id, date);

-- worker_preferences
-- Coarse per-worker scheduling preferences (prefers days vs nights, limits, pattern).
CREATE TABLE IF NOT EXISTS maywin_db.worker_preferences (
  id                          bigserial   PRIMARY KEY,
  worker_id                   bigint      NOT NULL UNIQUE REFERENCES maywin_db.workers(id) ON DELETE CASCADE,
  prefers_day_shifts          boolean,
  prefers_night_shifts        boolean,
  max_consecutive_work_days   int,
  max_consecutive_night_shifts int,
  preference_pattern_json     jsonb,      -- { penalties: { "2026-04-01": { Night: 5 } } }
  days_off_pattern_json       jsonb,      -- preferred recurring days off
  attributes                  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- worker_messages
-- Audit log of inbound/outbound LINE messages between nurses and the system.
CREATE TABLE IF NOT EXISTS maywin_db.worker_messages (
  id               uuid                         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  bigint                       NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  unit_id          bigint                       REFERENCES maywin_db.units(id) ON DELETE SET NULL,
  worker_id        bigint                       NOT NULL REFERENCES maywin_db.workers(id) ON DELETE CASCADE,
  sender_user_id   bigint                       REFERENCES maywin_db.users(id) ON DELETE SET NULL,
  sender_worker_id bigint                       REFERENCES maywin_db.workers(id) ON DELETE SET NULL,
  direction        maywin_db.message_direction  NOT NULL,
  status           maywin_db.message_status     NOT NULL,
  subject          text,
  body             text                         NOT NULL,
  job_id           uuid,
  schedule_id      bigint,
  shift_date       date,
  shift_code       text,
  attributes       jsonb                        NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz                  NOT NULL DEFAULT now(),
  updated_at       timestamptz                  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_worker_messages_worker_time ON maywin_db.worker_messages (worker_id, created_at);
CREATE INDEX IF NOT EXISTS ix_worker_messages_unit_time   ON maywin_db.worker_messages (unit_id, created_at) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_worker_messages_job_time    ON maywin_db.worker_messages (job_id, created_at)  WHERE job_id IS NOT NULL;

-- chatbot_conversations
-- Per-LINE-user session state for the availability-submission chatbot.
CREATE TABLE IF NOT EXISTS maywin_db.chatbot_conversations (
  id              uuid                           PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id    text                           NOT NULL UNIQUE,
  worker_id       bigint                         REFERENCES maywin_db.workers(id),
  organization_id bigint                         REFERENCES maywin_db.organizations(id) ON DELETE SET NULL,
  unit_id         bigint                         REFERENCES maywin_db.units(id) ON DELETE SET NULL,
  state           maywin_db.conversation_state   NOT NULL DEFAULT 'IDLE',
  pending_data    jsonb,
  attributes      jsonb                          NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz                    NOT NULL DEFAULT now(),
  updated_at      timestamptz                    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_chatbot_conversations_line_user_id ON maywin_db.chatbot_conversations (line_user_id);
CREATE INDEX IF NOT EXISTS ix_chatbot_conversations_worker_id
  ON maywin_db.chatbot_conversations (worker_id) WHERE worker_id IS NOT NULL;

-- line_link_tokens
-- Short-lived tokens that allow nurses to link their LINE account to a worker record.
CREATE TABLE IF NOT EXISTS maywin_db.line_link_tokens (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id  bigint      NOT NULL REFERENCES maywin_db.workers(id) ON DELETE CASCADE,
  token      text        NOT NULL UNIQUE,   -- e.g. "A3X9K2"
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_line_link_tokens_worker_id ON maywin_db.line_link_tokens (worker_id);

-- =============================================================================
-- SECTION 4 — SCHEDULING CONFIGURATION
-- =============================================================================

-- shift_templates
-- Defines the shift codes used by a unit (Morning, Evening, Night …).
CREATE TABLE IF NOT EXISTS maywin_db.shift_templates (
  id              bigserial   PRIMARY KEY,
  organization_id bigint      NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  unit_id         bigint      REFERENCES maywin_db.units(id) ON DELETE SET NULL,  -- NULL = org-wide default
  code            text        NOT NULL,
  name            text        NOT NULL,
  start_time      time        NOT NULL,   -- e.g. 07:00
  end_time        time        NOT NULL,   -- e.g. 15:00
  is_active       boolean     NOT NULL DEFAULT true,
  attributes      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_templates_org_unit_code_uniq UNIQUE (organization_id, unit_id, code)
);

-- coverage_rules
-- Minimum (and optional maximum) headcount per shift per day-type per unit.
-- required_tag: if set, at least one of the assigned workers must carry this skill tag.
CREATE TABLE IF NOT EXISTS maywin_db.coverage_rules (
  id           bigserial   PRIMARY KEY,
  unit_id      bigint      NOT NULL REFERENCES maywin_db.units(id) ON DELETE CASCADE,
  shift_code   text        NOT NULL,
  day_type     text        NOT NULL,   -- 'WEEKDAY' | 'WEEKEND'
  min_workers  int,
  max_workers  int,
  required_tag text,                   -- e.g. 'Senior' — mapped to required_skills in solver
  attributes   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_coverage_rules_unit ON maywin_db.coverage_rules (unit_id);

-- constraint_profiles
-- Scheduling rule sets consumed by the OR-Tools solver (app3.py).
-- Can be unit-scoped (unit_id set) for solver use, or org-scoped (org_id set)
-- for the hospital-admin UI. One active profile is selected at job-creation time.
CREATE TABLE IF NOT EXISTS maywin_db.constraint_profiles (
  id              bigserial   PRIMARY KEY,
  unit_id         bigint      REFERENCES maywin_db.units(id) ON DELETE CASCADE,  -- nullable: org-level profiles have no unit
  org_id          bigint      REFERENCES maywin_db.organizations(id) ON DELETE SET NULL,  -- set for org-level profiles
  name            text        NOT NULL,
  description     text,                                                            -- UI display field
  assigned_to     text,                                                            -- department label (UI display)
  color           text        NOT NULL DEFAULT 'primary',                          -- UI accent: primary | warning | success
  constraints_json  jsonb,                                                         -- UI-friendly constraints key-value array
  goals_json        jsonb,                                                         -- UI-friendly goals key-value array

  -- ── sequence / rest ────────────────────────────────────────────────────────
  max_consecutive_work_days     int,          -- Rules.max_consecutive_work_days
  max_consecutive_night_shifts  int,          -- Rules.max_consecutive_shifts
  min_rest_hours_between_shifts int,          -- Rules.min_rest_hours_between_shifts

  -- ── daily / weekly limits ──────────────────────────────────────────────────
  max_shifts_per_day            int         NOT NULL DEFAULT 1,   -- Rules.max_shifts_per_day
  min_days_off_per_week         int         NOT NULL DEFAULT 2,   -- Rules.min_days_off_per_week
  max_nights_per_week           int         NOT NULL DEFAULT 2,   -- Rules.max_nights_per_week

  -- ── shift-sequence toggles ─────────────────────────────────────────────────
  forbid_night_to_morning           boolean NOT NULL DEFAULT true,
  forbid_morning_to_night_same_day  boolean NOT NULL DEFAULT false,
  forbid_evening_to_night           boolean NOT NULL DEFAULT true,  -- prevents 16:00-24:00 → 00:00-08:00 (0h rest)

  -- ── coverage / emergency toggles ──────────────────────────────────────────
  guarantee_full_coverage                   boolean NOT NULL DEFAULT true,
  allow_emergency_overrides                 boolean NOT NULL DEFAULT true,
  allow_second_shift_same_day_in_emergency  boolean NOT NULL DEFAULT true,
  ignore_availability_in_emergency          boolean NOT NULL DEFAULT false,
  allow_night_cap_override_in_emergency     boolean NOT NULL DEFAULT true,
  allow_rest_rule_override_in_emergency     boolean NOT NULL DEFAULT true,

  -- ── goal toggles ──────────────────────────────────────────────────────────
  goal_minimize_staff_cost              boolean NOT NULL DEFAULT true,
  goal_maximize_preference_satisfaction boolean NOT NULL DEFAULT true,
  goal_balance_workload                 boolean NOT NULL DEFAULT false,
  goal_balance_night_workload           boolean NOT NULL DEFAULT false,
  goal_reduce_undesirable_shifts        boolean NOT NULL DEFAULT true,

  -- ── objective weights (app3.py Weights model) ─────────────────────────────
  -- Keys: understaff_penalty, overtime_penalty, preference_penalty_multiplier,
  --       workload_balance_weight, emergency_override_penalty,
  --       same_day_second_shift_penalty, weekly_night_over_penalty
  penalty_weight_json   jsonb,

  -- ── fairness weights (app3.py FairnessWeights model) ─────────────────────
  -- Keys: workload_balance, night_balance, shift_type_balance
  fairness_weight_json  jsonb,

  -- ── goal priority (app3.py GoalPriority model) ───────────────────────────
  -- Keys: coverage, cost, preference, fairness  (1 = highest priority)
  goal_priority_json    jsonb,

  -- ── solver execution tuning ───────────────────────────────────────────────
  num_search_workers  int   NOT NULL DEFAULT 8,
  time_limit_sec      real  NOT NULL DEFAULT 20,

  -- ── meta ──────────────────────────────────────────────────────────────────
  is_active   boolean     NOT NULL DEFAULT true,
  attributes  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_constraint_profiles_unit ON maywin_db.constraint_profiles (unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_constraint_profiles_org  ON maywin_db.constraint_profiles (org_id)  WHERE org_id  IS NOT NULL;

-- =============================================================================
-- SECTION 5 — SCHEDULES & ASSIGNMENTS
-- =============================================================================

-- schedules
-- A published (or draft) nurse schedule for a unit over a date range.
CREATE TABLE IF NOT EXISTS maywin_db.schedules (
  id                   bigserial                    PRIMARY KEY,
  organization_id      bigint                       NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  unit_id              bigint                       REFERENCES maywin_db.units(id) ON DELETE SET NULL,  -- nullable: org-level containers have no unit
  job_id               uuid,                        -- FK to schedule_jobs (no constraint — job may be gone)
  name                 text                         NOT NULL DEFAULT 'Generated Schedule',
  start_date           date                         NOT NULL,
  end_date             date                         NOT NULL,
  status               maywin_db.schedule_status    NOT NULL DEFAULT 'DRAFT',
  constraint_profile_id bigint                      REFERENCES maywin_db.constraint_profiles(id),
  last_solver_run_id   bigint,                      -- FK to solver_runs (set after apply)
  current_run_id       bigint,                      -- FK to schedule_runs (latest committed run)
  created_by           bigint                       NOT NULL REFERENCES maywin_db.users(id),
  created_at           timestamptz                  NOT NULL DEFAULT now(),
  published_at         timestamptz,
  published_by         bigint                       REFERENCES maywin_db.users(id),
  notes                text,                        -- free-text notes (org-level containers / admin use)
  attributes           jsonb                        NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_schedules_unit_dates ON maywin_db.schedules (unit_id, start_date, end_date);

-- schedule_runs
-- A versioned "commit" of assignments for a schedule (immutable once created).
CREATE TABLE IF NOT EXISTS maywin_db.schedule_runs (
  id          bigserial   PRIMARY KEY,
  schedule_id bigint      NOT NULL REFERENCES maywin_db.schedules(id) ON DELETE CASCADE,
  job_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_schedule_runs_schedule ON maywin_db.schedule_runs (schedule_id);

-- schedule_assignments
-- The actual nurse → date → shift assignments within one schedule run.
CREATE TABLE IF NOT EXISTS maywin_db.schedule_assignments (
  id               bigserial   PRIMARY KEY,
  schedule_id      bigint      NOT NULL REFERENCES maywin_db.schedules(id) ON DELETE CASCADE,
  schedule_run_id  bigint      NOT NULL REFERENCES maywin_db.schedule_runs(id) ON DELETE CASCADE,
  worker_id        bigint      NOT NULL REFERENCES maywin_db.workers(id) ON DELETE CASCADE,
  date             date        NOT NULL,
  shift_code       text        NOT NULL,
  source           text        NOT NULL DEFAULT 'SOLVER',  -- 'SOLVER' | 'MANUAL'
  emergency_override boolean   NOT NULL DEFAULT false,     -- solver v3: was this assigned via Phase-2 override?
  attributes       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sa_run_uniq UNIQUE (schedule_run_id, worker_id, date)
);

CREATE INDEX IF NOT EXISTS ix_schedule_assignments_date
  ON maywin_db.schedule_assignments (schedule_id, date);

-- =============================================================================
-- SECTION 6 — ORCHESTRATION (solver pipeline)
-- =============================================================================

-- schedule_jobs
-- A request to run the solver for a unit over a horizon. Tracks pipeline state.
CREATE TABLE IF NOT EXISTS maywin_db.schedule_jobs (
  id               uuid                              PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  bigint                            NOT NULL REFERENCES maywin_db.organizations(id) ON DELETE CASCADE,
  unit_id          bigint                            NOT NULL REFERENCES maywin_db.units(id),
  requested_by     bigint                            NOT NULL REFERENCES maywin_db.users(id),
  idempotency_key  text,
  status           maywin_db.schedule_job_status     NOT NULL DEFAULT 'REQUESTED',
  start_date       date                              NOT NULL,
  end_date         date                              NOT NULL,
  chosen_plan      maywin_db.solver_plan,
  final_schedule_id bigint                           REFERENCES maywin_db.schedules(id),
  error_code       text,
  error_message    text,
  attributes       jsonb                             NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz                       NOT NULL DEFAULT now(),
  updated_at       timestamptz                       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_schedule_jobs_unit   ON maywin_db.schedule_jobs (unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_schedule_jobs_status ON maywin_db.schedule_jobs (status) WHERE status NOT IN ('COMPLETED','FAILED');

-- schedule_job_events
-- Append-only audit log of job state transitions and notable pipeline events.
CREATE TABLE IF NOT EXISTS maywin_db.schedule_job_events (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id     uuid        NOT NULL REFERENCES maywin_db.schedule_jobs(id) ON DELETE CASCADE,
  event_type text        NOT NULL,
  message    text,
  payload    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_schedule_job_events_job ON maywin_db.schedule_job_events (job_id, created_at);

-- schedule_artifacts
-- Stores normalized-input / solver-output / KPI JSON blobs, either inline
-- (storage_provider = 'db', payload in metadata) or by reference to S3.
CREATE TABLE IF NOT EXISTS maywin_db.schedule_artifacts (
  id               uuid                              PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id           uuid                              NOT NULL REFERENCES maywin_db.schedule_jobs(id) ON DELETE CASCADE,
  type             maywin_db.schedule_artifact_type  NOT NULL,
  storage_provider text                              NOT NULL DEFAULT 'db',  -- 'db' | 's3'
  bucket           text,
  object_key       text,
  content_type     text,
  content_sha256   text,
  content_bytes    bigint,
  metadata         jsonb                             NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz                       NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_schedule_artifacts_job_type
  ON maywin_db.schedule_artifacts (job_id, type);

-- solver_runs
-- A single invocation of the OR-Tools solver (one plan, one attempt).
-- Multiple runs can exist per job (A_STRICT → A_RELAXED → B_MILP fallback chain).
CREATE TABLE IF NOT EXISTS maywin_db.solver_runs (
  id                   bigserial                     PRIMARY KEY,
  job_id               uuid                          REFERENCES maywin_db.schedule_jobs(id),
  schedule_id          bigint                        REFERENCES maywin_db.schedules(id),
  plan                 maywin_db.solver_plan         NOT NULL,
  status               maywin_db.solver_run_status   NOT NULL DEFAULT 'QUEUED',
  requested_by         bigint                        NOT NULL REFERENCES maywin_db.users(id),
  notes                text,
  attempt              int                           NOT NULL DEFAULT 1,
  input_artifact_id    uuid                          REFERENCES maywin_db.schedule_artifacts(id),
  output_artifact_id   uuid                          REFERENCES maywin_db.schedule_artifacts(id),
  evaluation_artifact_id uuid                        REFERENCES maywin_db.schedule_artifacts(id),
  -- timing
  created_at           timestamptz                   NOT NULL DEFAULT now(),
  started_at           timestamptz,
  finished_at          timestamptz,
  -- outcome
  objective_value      numeric(12, 4),               -- minimized cost from CP-SAT
  failure_reason       text,
  -- kpis (aggregate metrics from app3.py SolveResponse.details)
  kpis_json            jsonb,
  -- solver v3: per-nurse stats and understaffed slots
  nurse_stats_json     jsonb,                        -- NurseStats[]  from app3.py
  understaffed_json    jsonb,                        -- UnderstaffItem[] from app3.py
  -- misc
  attributes           jsonb                         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_solver_runs_job    ON maywin_db.solver_runs (job_id)      WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_solver_runs_status ON maywin_db.solver_runs (status)      WHERE status IN ('QUEUED','RUNNING');

-- solver_run_assignments
-- Raw assignment rows written by the solver before they are committed to
-- schedule_assignments. Kept as a permanent record per run.
CREATE TABLE IF NOT EXISTS maywin_db.solver_run_assignments (
  id               bigserial   PRIMARY KEY,
  solver_run_id    bigint      NOT NULL REFERENCES maywin_db.solver_runs(id) ON DELETE CASCADE,
  worker_id        bigint      NOT NULL REFERENCES maywin_db.workers(id),
  date             date        NOT NULL,
  shift_code       text        NOT NULL,
  emergency_override boolean   NOT NULL DEFAULT false,  -- solver v3: Phase-2 emergency flag
  attributes       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sra_uniq UNIQUE (solver_run_id, worker_id, date)
);

CREATE INDEX IF NOT EXISTS ix_solver_run_assignments_run
  ON maywin_db.solver_run_assignments (solver_run_id);

-- =============================================================================
-- SECTION 7 — TYPEORM MIGRATIONS TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS maywin_db.migrations (
  id        serial      PRIMARY KEY,
  timestamp bigint      NOT NULL,
  name      varchar     NOT NULL
);

-- Seed: mark all migrations that have already been applied
-- (Run only on a fresh database — safe to omit if using migration:run)
INSERT INTO maywin_db.migrations (timestamp, name) VALUES
  (1766508705674, 'Baseline1766508705674'),
  (1767106500000, 'AddWorkerMessages1767106500000'),
  (1767210000000, 'AddScheduleRuns1767210000000'),
  (1739894400000, 'AddChatbotConversations1739894400000'),
  (1772190770101, 'AddDayOffToAvailabilityTypeEnum1772190770101'),
  (1773878400000, 'AddSolverV3Fields1773878400000'),
  (1774000000000, 'AddOrgLevelFeatures1774000000000')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
