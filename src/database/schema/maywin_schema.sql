BEGIN;

-- ============================================================
-- MayWin DB Schema (Domain bigint IDs + Orchestration uuid IDs)
-- Paste into pgAdmin 4 Query Tool and run on a FRESH database.
-- ============================================================

-- 0) Schema + extensions
CREATE SCHEMA IF NOT EXISTS maywin_db;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) ENUM TYPES (run on fresh DB; will error if types already exist)
CREATE TYPE maywin_db.schedule_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE maywin_db.availability_type AS ENUM ('AVAILABLE','UNAVAILABLE','PREFERRED','AVOID');
CREATE TYPE maywin_db.employment_type AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','TEMP');

CREATE TYPE maywin_db.solver_plan AS ENUM ('A_STRICT','A_RELAXED','B_MILP');
CREATE TYPE maywin_db.solver_run_status AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELED');

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

CREATE TYPE maywin_db.schedule_artifact_type AS ENUM (
  'NORMALIZED_INPUT',
  'SOLVER_OUTPUT',
  'EVALUATION_REPORT',
  'FINAL_SCHEDULE_EXPORT'
);

-- 2) CORE DOMAIN TABLES
CREATE TABLE IF NOT EXISTS maywin_db.organizations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'Asia/Bangkok',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maywin_db.roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maywin_db.users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maywin_db.sites (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  timezone text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sites_org_code_uniq UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS maywin_db.units (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  site_id bigint NULL,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_org_code_uniq UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS maywin_db.unit_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id bigint NOT NULL,
  user_id bigint NOT NULL,
  role_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT um_unit_user_uniq UNIQUE (unit_id, user_id)
);

CREATE TABLE IF NOT EXISTS maywin_db.user_roles (
  user_id bigint NOT NULL,
  role_id bigint NOT NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS maywin_db.workers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  primary_unit_id bigint NULL,
  full_name text NOT NULL,
  worker_code text NULL,
  employment_type maywin_db.employment_type NULL,
  weekly_hours integer NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  linked_user_id bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workers_org_code_uniq UNIQUE (organization_id, worker_code)
);

CREATE TABLE IF NOT EXISTS maywin_db.worker_unit_memberships (
  worker_id bigint NOT NULL,
  unit_id bigint NOT NULL,
  role_code text NULL,
  CONSTRAINT worker_unit_memberships_pkey PRIMARY KEY (worker_id, unit_id)
);

CREATE TABLE IF NOT EXISTS maywin_db.shift_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  unit_id bigint NULL,
  code text NOT NULL,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT st_uniq UNIQUE (organization_id, unit_id, code)
);

CREATE TABLE IF NOT EXISTS maywin_db.coverage_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id bigint NOT NULL,
  shift_code text NOT NULL,
  day_type text NOT NULL,
  min_workers integer NULL,
  max_workers integer NULL,
  required_tag text NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maywin_db.constraint_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id bigint NOT NULL,
  name text NOT NULL,
  max_consecutive_work_days integer NULL,
  max_consecutive_night_shifts integer NULL,
  min_rest_hours_between_shifts integer NULL,
  fairness_weight_json jsonb NULL,
  penalty_weight_json jsonb NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maywin_db.worker_availability (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  worker_id bigint NOT NULL,
  unit_id bigint NOT NULL,
  date date NOT NULL,
  shift_code text NOT NULL,
  type maywin_db.availability_type NOT NULL,
  source text NOT NULL,
  reason text NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_uniq UNIQUE (worker_id, unit_id, date, shift_code)
);

CREATE TABLE IF NOT EXISTS maywin_db.worker_preferences (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  worker_id bigint NOT NULL UNIQUE,
  prefers_day_shifts boolean NULL,
  prefers_night_shifts boolean NULL,
  max_consecutive_work_days integer NULL,
  max_consecutive_night_shifts integer NULL,
  preference_pattern_json jsonb NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) ORCHESTRATION TABLES (NEW)
CREATE TABLE IF NOT EXISTS maywin_db.schedule_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id bigint NOT NULL,
  unit_id bigint NOT NULL,
  requested_by bigint NOT NULL,

  idempotency_key text NULL,
  status maywin_db.schedule_job_status NOT NULL DEFAULT 'REQUESTED'::maywin_db.schedule_job_status,

  start_date date NOT NULL,
  end_date date NOT NULL,

  chosen_plan maywin_db.solver_plan NULL,
  final_schedule_id bigint NULL,

  error_code text NULL,
  error_message text NULL,

  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_jobs_idempotency
  ON maywin_db.schedule_jobs (unit_id, requested_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_schedule_jobs_unit_status
  ON maywin_db.schedule_jobs (unit_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS maywin_db.schedule_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  type maywin_db.schedule_artifact_type NOT NULL,

  storage_provider text NOT NULL DEFAULT 's3',
  bucket text NULL,
  object_key text NULL,
  content_type text NULL,
  content_sha256 text NULL,
  content_bytes bigint NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_schedule_artifacts_job_type
  ON maywin_db.schedule_artifacts (job_id, type, created_at DESC);

CREATE TABLE IF NOT EXISTS maywin_db.schedule_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  event_type text NOT NULL,
  message text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_schedule_job_events_job_time
  ON maywin_db.schedule_job_events (job_id, created_at DESC);

-- 4) OUTPUT TABLES (SCHEDULES + ASSIGNMENTS) WITH IDEMPOTENCY
CREATE TABLE IF NOT EXISTS maywin_db.schedules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  organization_id bigint NOT NULL,
  unit_id bigint NOT NULL,

  -- makes PersistSchedule idempotent
  job_id uuid NULL,

  name text NOT NULL DEFAULT 'Generated Schedule',
  start_date date NOT NULL,
  end_date date NOT NULL,

  status maywin_db.schedule_status NOT NULL DEFAULT 'DRAFT'::maywin_db.schedule_status,

  constraint_profile_id bigint NULL,
  last_solver_run_id bigint NULL,

  created_by bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  published_by bigint NULL,

  attributes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedules_job_id
  ON maywin_db.schedules (job_id)
  WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS maywin_db.schedule_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule_id bigint NOT NULL,
  worker_id bigint NOT NULL,
  date date NOT NULL,
  shift_code text NOT NULL,
  source text NOT NULL DEFAULT 'SOLVER',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sa_uniq UNIQUE (schedule_id, worker_id, date)
);

-- 5) SOLVER RUNS (TRACK PLANS + ARTIFACTS)
CREATE TABLE IF NOT EXISTS maywin_db.solver_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- for orchestration tracking (recommended)
  job_id uuid NULL,

  -- keep for backward compatibility with old design
  schedule_id bigint NULL,

  plan maywin_db.solver_plan NOT NULL,
  status maywin_db.solver_run_status NOT NULL DEFAULT 'QUEUED'::maywin_db.solver_run_status,

  requested_by bigint NOT NULL,
  notes text NULL,

  attempt integer NOT NULL DEFAULT 1,

  input_artifact_id uuid NULL,
  output_artifact_id uuid NULL,
  evaluation_artifact_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  failure_reason text NULL,
  kpis_json jsonb NULL,
  objective_value numeric(12,4) NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- prevent double-running same plan for same job
CREATE UNIQUE INDEX IF NOT EXISTS uq_solver_runs_job_plan
  ON maywin_db.solver_runs (job_id, plan)
  WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS maywin_db.solver_run_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solver_run_id bigint NOT NULL,
  worker_id bigint NOT NULL,
  date date NOT NULL,
  shift_code text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sra_uniq UNIQUE (solver_run_id, worker_id, date)
);

-- 6) INDEXES (helpful defaults)
CREATE INDEX IF NOT EXISTS ix_coverage_rules_unit
  ON maywin_db.coverage_rules (unit_id);

CREATE INDEX IF NOT EXISTS ix_worker_availability_worker_date
  ON maywin_db.worker_availability (worker_id, date);

CREATE INDEX IF NOT EXISTS ix_schedule_assignments_schedule
  ON maywin_db.schedule_assignments (schedule_id);

CREATE INDEX IF NOT EXISTS ix_solver_runs_job
  ON maywin_db.solver_runs (job_id);

-- 7) FOREIGN KEYS (NO "IF NOT EXISTS" ON CONSTRAINTS)

-- users/org
ALTER TABLE maywin_db.users
  ADD CONSTRAINT users_org_fk
  FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations (id);

-- sites/org
ALTER TABLE maywin_db.sites
  ADD CONSTRAINT sites_org_fk
  FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations (id);

-- units/org + units/site
ALTER TABLE maywin_db.units
  ADD CONSTRAINT units_org_fk
  FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations (id);

ALTER TABLE maywin_db.units
  ADD CONSTRAINT units_site_fk
  FOREIGN KEY (site_id) REFERENCES maywin_db.sites (id);

-- unit_memberships
ALTER TABLE maywin_db.unit_memberships
  ADD CONSTRAINT um_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.unit_memberships
  ADD CONSTRAINT um_user_fk
  FOREIGN KEY (user_id) REFERENCES maywin_db.users (id) ON DELETE CASCADE;

-- user_roles
ALTER TABLE maywin_db.user_roles
  ADD CONSTRAINT ur_user_fk
  FOREIGN KEY (user_id) REFERENCES maywin_db.users (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.user_roles
  ADD CONSTRAINT ur_role_fk
  FOREIGN KEY (role_id) REFERENCES maywin_db.roles (id) ON DELETE CASCADE;

-- workers
ALTER TABLE maywin_db.workers
  ADD CONSTRAINT workers_org_fk
  FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations (id);

ALTER TABLE maywin_db.workers
  ADD CONSTRAINT workers_primary_unit_fk
  FOREIGN KEY (primary_unit_id) REFERENCES maywin_db.units (id);

ALTER TABLE maywin_db.workers
  ADD CONSTRAINT workers_linked_user_fk
  FOREIGN KEY (linked_user_id) REFERENCES maywin_db.users (id);

-- worker_unit_memberships
ALTER TABLE maywin_db.worker_unit_memberships
  ADD CONSTRAINT wum_worker_fk
  FOREIGN KEY (worker_id) REFERENCES maywin_db.workers (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.worker_unit_memberships
  ADD CONSTRAINT wum_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id) ON DELETE CASCADE;

-- shift_templates
ALTER TABLE maywin_db.shift_templates
  ADD CONSTRAINT st_org_fk
  FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations (id);

ALTER TABLE maywin_db.shift_templates
  ADD CONSTRAINT st_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id);

-- coverage_rules
ALTER TABLE maywin_db.coverage_rules
  ADD CONSTRAINT cr_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id) ON DELETE CASCADE;

-- constraint_profiles
ALTER TABLE maywin_db.constraint_profiles
  ADD CONSTRAINT cp_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id) ON DELETE CASCADE;

-- worker_availability
ALTER TABLE maywin_db.worker_availability
  ADD CONSTRAINT wa_worker_fk
  FOREIGN KEY (worker_id) REFERENCES maywin_db.workers (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.worker_availability
  ADD CONSTRAINT wa_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id);

-- worker_preferences
ALTER TABLE maywin_db.worker_preferences
  ADD CONSTRAINT wp_worker_fk
  FOREIGN KEY (worker_id) REFERENCES maywin_db.workers (id) ON DELETE CASCADE;

-- schedules
ALTER TABLE maywin_db.schedules
  ADD CONSTRAINT sch_org_fk
  FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations (id);

ALTER TABLE maywin_db.schedules
  ADD CONSTRAINT sch_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id);

ALTER TABLE maywin_db.schedules
  ADD CONSTRAINT sch_created_by_fk
  FOREIGN KEY (created_by) REFERENCES maywin_db.users (id);

ALTER TABLE maywin_db.schedules
  ADD CONSTRAINT sch_published_by_fk
  FOREIGN KEY (published_by) REFERENCES maywin_db.users (id);

ALTER TABLE maywin_db.schedules
  ADD CONSTRAINT sch_cp_fk
  FOREIGN KEY (constraint_profile_id) REFERENCES maywin_db.constraint_profiles (id);

-- schedule_assignments
ALTER TABLE maywin_db.schedule_assignments
  ADD CONSTRAINT sa_schedule_fk
  FOREIGN KEY (schedule_id) REFERENCES maywin_db.schedules (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.schedule_assignments
  ADD CONSTRAINT sa_worker_fk
  FOREIGN KEY (worker_id) REFERENCES maywin_db.workers (id);

-- solver_runs
ALTER TABLE maywin_db.solver_runs
  ADD CONSTRAINT sr_schedule_fk
  FOREIGN KEY (schedule_id) REFERENCES maywin_db.schedules (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.solver_runs
  ADD CONSTRAINT sr_requested_by_fk
  FOREIGN KEY (requested_by) REFERENCES maywin_db.users (id);

-- solver_run_assignments
ALTER TABLE maywin_db.solver_run_assignments
  ADD CONSTRAINT sra_run_fk
  FOREIGN KEY (solver_run_id) REFERENCES maywin_db.solver_runs (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.solver_run_assignments
  ADD CONSTRAINT sra_worker_fk
  FOREIGN KEY (worker_id) REFERENCES maywin_db.workers (id);

-- orchestration FKs
ALTER TABLE maywin_db.schedule_jobs
  ADD CONSTRAINT sj_org_fk
  FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations (id);

ALTER TABLE maywin_db.schedule_jobs
  ADD CONSTRAINT sj_unit_fk
  FOREIGN KEY (unit_id) REFERENCES maywin_db.units (id);

ALTER TABLE maywin_db.schedule_jobs
  ADD CONSTRAINT sj_requested_by_fk
  FOREIGN KEY (requested_by) REFERENCES maywin_db.users (id);

ALTER TABLE maywin_db.schedule_jobs
  ADD CONSTRAINT sj_final_schedule_fk
  FOREIGN KEY (final_schedule_id) REFERENCES maywin_db.schedules (id) ON DELETE SET NULL;

ALTER TABLE maywin_db.schedules
  ADD CONSTRAINT sch_job_fk
  FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs (id) ON DELETE SET NULL;

ALTER TABLE maywin_db.solver_runs
  ADD CONSTRAINT sr_job_fk
  FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs (id) ON DELETE SET NULL;

ALTER TABLE maywin_db.schedule_artifacts
  ADD CONSTRAINT s_art_job_fk
  FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.schedule_job_events
  ADD CONSTRAINT s_evt_job_fk
  FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs (id) ON DELETE CASCADE;

ALTER TABLE maywin_db.solver_runs
  ADD CONSTRAINT sr_input_artifact_fk
  FOREIGN KEY (input_artifact_id) REFERENCES maywin_db.schedule_artifacts (id) ON DELETE SET NULL;

ALTER TABLE maywin_db.solver_runs
  ADD CONSTRAINT sr_output_artifact_fk
  FOREIGN KEY (output_artifact_id) REFERENCES maywin_db.schedule_artifacts (id) ON DELETE SET NULL;

ALTER TABLE maywin_db.solver_runs
  ADD CONSTRAINT sr_eval_artifact_fk
  FOREIGN KEY (evaluation_artifact_id) REFERENCES maywin_db.schedule_artifacts (id) ON DELETE SET NULL;

COMMIT;
