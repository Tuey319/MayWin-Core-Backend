--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

-- Started on 2026-04-22 11:07:52

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 8 (class 2615 OID 16479)
-- Name: maywin_db; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS maywin_db;


ALTER SCHEMA maywin_db OWNER TO postgres;

--
-- TOC entry 2 (class 3079 OID 16480)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 4799 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 3 (class 3079 OID 17064)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4800 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 950 (class 1247 OID 16526)
-- Name: availability_type; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.availability_type AS ENUM (
    'AVAILABLE',
    'UNAVAILABLE',
    'PREFERRED',
    'AVOID',
    'DAY_OFF'
);


ALTER TYPE maywin_db.availability_type OWNER TO postgres;

--
-- TOC entry 1046 (class 1247 OID 24623)
-- Name: conversation_state; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.conversation_state AS ENUM (
    'IDLE',
    'AWAITING_CONFIRMATION',
    'PROCESSING'
);


ALTER TYPE maywin_db.conversation_state OWNER TO postgres;

--
-- TOC entry 953 (class 1247 OID 16536)
-- Name: employment_type; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.employment_type AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'TEMP'
);


ALTER TYPE maywin_db.employment_type OWNER TO postgres;

--
-- TOC entry 1031 (class 1247 OID 17119)
-- Name: message_direction; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.message_direction AS ENUM (
    'INBOUND',
    'OUTBOUND'
);


ALTER TYPE maywin_db.message_direction OWNER TO postgres;

--
-- TOC entry 1034 (class 1247 OID 17124)
-- Name: message_status; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.message_status AS ENUM (
    'SENT',
    'DELIVERED',
    'READ',
    'ARCHIVED'
);


ALTER TYPE maywin_db.message_status OWNER TO postgres;

--
-- TOC entry 965 (class 1247 OID 16588)
-- Name: schedule_artifact_type; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.schedule_artifact_type AS ENUM (
    'NORMALIZED_INPUT',
    'SOLVER_OUTPUT',
    'EVALUATION_REPORT',
    'FINAL_SCHEDULE_EXPORT',
    'KPI_SUMMARY'
);


ALTER TYPE maywin_db.schedule_artifact_type OWNER TO postgres;

--
-- TOC entry 962 (class 1247 OID 16566)
-- Name: schedule_job_status; Type: TYPE; Schema: maywin_db; Owner: postgres
--

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


ALTER TYPE maywin_db.schedule_job_status OWNER TO postgres;

--
-- TOC entry 947 (class 1247 OID 16518)
-- Name: schedule_status; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.schedule_status AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);


ALTER TYPE maywin_db.schedule_status OWNER TO postgres;

--
-- TOC entry 956 (class 1247 OID 16546)
-- Name: solver_plan; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.solver_plan AS ENUM (
    'A_STRICT',
    'A_RELAXED',
    'B_MILP'
);


ALTER TYPE maywin_db.solver_plan OWNER TO postgres;

--
-- TOC entry 959 (class 1247 OID 16554)
-- Name: solver_run_status; Type: TYPE; Schema: maywin_db; Owner: postgres
--

CREATE TYPE maywin_db.solver_run_status AS ENUM (
    'QUEUED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELED'
);


ALTER TYPE maywin_db.solver_run_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 265 (class 1259 OID 32795)
-- Name: auth_otps; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.auth_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id bigint NOT NULL,
    otp_code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.auth_otps OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 24629)
-- Name: chatbot_conversations; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.chatbot_conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    line_user_id text NOT NULL,
    worker_id bigint,
    organization_id bigint,
    unit_id bigint,
    state maywin_db.conversation_state DEFAULT 'IDLE'::maywin_db.conversation_state NOT NULL,
    pending_data jsonb,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.chatbot_conversations OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 16727)
-- Name: constraint_profiles; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.constraint_profiles (
    id bigint NOT NULL,
    unit_id bigint,
    name text NOT NULL,
    max_consecutive_work_days integer,
    max_consecutive_night_shifts integer,
    min_rest_hours_between_shifts integer,
    fairness_weight_json jsonb,
    penalty_weight_json jsonb,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    max_shifts_per_day integer DEFAULT 1 NOT NULL,
    min_days_off_per_week integer DEFAULT 2 NOT NULL,
    max_nights_per_week integer DEFAULT 2 NOT NULL,
    forbid_night_to_morning boolean DEFAULT true NOT NULL,
    forbid_morning_to_night_same_day boolean DEFAULT false NOT NULL,
    guarantee_full_coverage boolean DEFAULT true NOT NULL,
    allow_emergency_overrides boolean DEFAULT true NOT NULL,
    allow_second_shift_same_day_in_emergency boolean DEFAULT true NOT NULL,
    ignore_availability_in_emergency boolean DEFAULT false NOT NULL,
    allow_night_cap_override_in_emergency boolean DEFAULT true NOT NULL,
    allow_rest_rule_override_in_emergency boolean DEFAULT true NOT NULL,
    goal_minimize_staff_cost boolean DEFAULT true NOT NULL,
    goal_maximize_preference_satisfaction boolean DEFAULT true NOT NULL,
    goal_balance_workload boolean DEFAULT false NOT NULL,
    goal_balance_night_workload boolean DEFAULT false NOT NULL,
    goal_reduce_undesirable_shifts boolean DEFAULT true NOT NULL,
    goal_priority_json jsonb,
    num_search_workers integer DEFAULT 8 NOT NULL,
    time_limit_sec real DEFAULT 20 NOT NULL,
    org_id bigint,
    description text,
    assigned_to text,
    color text DEFAULT 'primary'::text NOT NULL,
    forbid_evening_to_night boolean DEFAULT true NOT NULL
);


ALTER TABLE maywin_db.constraint_profiles OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 16726)
-- Name: constraint_profiles_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.constraint_profiles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.constraint_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 241 (class 1259 OID 16717)
-- Name: coverage_rules; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.coverage_rules (
    id bigint NOT NULL,
    unit_id bigint NOT NULL,
    shift_code text NOT NULL,
    day_type text NOT NULL,
    min_workers integer,
    max_workers integer,
    required_tag text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.coverage_rules OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 16716)
-- Name: coverage_rules_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.coverage_rules ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.coverage_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 270 (class 1259 OID 34096)
-- Name: display_settings; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.display_settings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.display_settings OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 34095)
-- Name: display_settings_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

CREATE SEQUENCE maywin_db.display_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE maywin_db.display_settings_id_seq OWNER TO postgres;

--
-- TOC entry 4801 (class 0 OID 0)
-- Dependencies: 269
-- Name: display_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: maywin_db; Owner: postgres
--

ALTER SEQUENCE maywin_db.display_settings_id_seq OWNED BY maywin_db.display_settings.id;


--
-- TOC entry 272 (class 1259 OID 34117)
-- Name: export_options; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.export_options (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.export_options OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 34116)
-- Name: export_options_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

CREATE SEQUENCE maywin_db.export_options_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE maywin_db.export_options_id_seq OWNER TO postgres;

--
-- TOC entry 4802 (class 0 OID 0)
-- Dependencies: 271
-- Name: export_options_id_seq; Type: SEQUENCE OWNED BY; Schema: maywin_db; Owner: postgres
--

ALTER SEQUENCE maywin_db.export_options_id_seq OWNED BY maywin_db.export_options.id;


--
-- TOC entry 266 (class 1259 OID 32810)
-- Name: line_link_tokens; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.line_link_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    worker_id bigint NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.line_link_tokens OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 24604)
-- Name: migrations; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE maywin_db.migrations OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 24603)
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

CREATE SEQUENCE maywin_db.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE maywin_db.migrations_id_seq OWNER TO postgres;

--
-- TOC entry 4803 (class 0 OID 0)
-- Dependencies: 260
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: maywin_db; Owner: postgres
--

ALTER SEQUENCE maywin_db.migrations_id_seq OWNED BY maywin_db.migrations.id;


--
-- TOC entry 223 (class 1259 OID 16600)
-- Name: organizations; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.organizations (
    id bigint NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    timezone text DEFAULT 'Asia/Bangkok'::text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.organizations OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16599)
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.organizations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 225 (class 1259 OID 16614)
-- Name: roles; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.roles (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.roles OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16613)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 249 (class 1259 OID 16775)
-- Name: schedule_artifacts; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.schedule_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    type maywin_db.schedule_artifact_type NOT NULL,
    storage_provider text DEFAULT 's3'::text NOT NULL,
    bucket text,
    object_key text,
    content_type text,
    content_sha256 text,
    content_bytes bigint,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.schedule_artifacts OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 16812)
-- Name: schedule_assignments; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.schedule_assignments (
    id bigint NOT NULL,
    schedule_id bigint NOT NULL,
    worker_id bigint NOT NULL,
    date date NOT NULL,
    shift_code text NOT NULL,
    source text DEFAULT 'SOLVER'::text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    schedule_run_id bigint NOT NULL,
    emergency_override boolean DEFAULT false NOT NULL,
    shift_order integer DEFAULT 1 NOT NULL,
    is_overtime boolean DEFAULT false NOT NULL
);


ALTER TABLE maywin_db.schedule_assignments OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 16811)
-- Name: schedule_assignments_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.schedule_assignments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.schedule_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 250 (class 1259 OID 16787)
-- Name: schedule_job_events; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.schedule_job_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    event_type text NOT NULL,
    message text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.schedule_job_events OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 16761)
-- Name: schedule_jobs; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.schedule_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    requested_by bigint NOT NULL,
    idempotency_key text,
    status maywin_db.schedule_job_status DEFAULT 'REQUESTED'::maywin_db.schedule_job_status NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    chosen_plan maywin_db.solver_plan,
    final_schedule_id bigint,
    error_code text,
    error_message text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.schedule_jobs OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 24613)
-- Name: schedule_runs; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.schedule_runs (
    id bigint NOT NULL,
    schedule_id bigint NOT NULL,
    job_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.schedule_runs OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 24612)
-- Name: schedule_runs_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

CREATE SEQUENCE maywin_db.schedule_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE maywin_db.schedule_runs_id_seq OWNER TO postgres;

--
-- TOC entry 4804 (class 0 OID 0)
-- Dependencies: 262
-- Name: schedule_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: maywin_db; Owner: postgres
--

ALTER SEQUENCE maywin_db.schedule_runs_id_seq OWNED BY maywin_db.schedule_runs.id;


--
-- TOC entry 252 (class 1259 OID 16799)
-- Name: schedules; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.schedules (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    unit_id bigint,
    job_id uuid,
    name text DEFAULT 'Generated Schedule'::text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status maywin_db.schedule_status DEFAULT 'DRAFT'::maywin_db.schedule_status NOT NULL,
    constraint_profile_id bigint,
    last_solver_run_id bigint,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    published_by bigint,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    current_run_id bigint,
    notes text
);


ALTER TABLE maywin_db.schedules OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 16798)
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.schedules ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 239 (class 1259 OID 16704)
-- Name: shift_templates; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.shift_templates (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    unit_id bigint,
    code text NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.shift_templates OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 16703)
-- Name: shift_templates_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.shift_templates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.shift_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 229 (class 1259 OID 16639)
-- Name: sites; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.sites (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    address text,
    timezone text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.sites OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16638)
-- Name: sites_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.sites ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.sites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 258 (class 1259 OID 16839)
-- Name: solver_run_assignments; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.solver_run_assignments (
    id bigint NOT NULL,
    solver_run_id bigint NOT NULL,
    worker_id bigint NOT NULL,
    date date NOT NULL,
    shift_code text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    emergency_override boolean DEFAULT false NOT NULL
);


ALTER TABLE maywin_db.solver_run_assignments OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 16838)
-- Name: solver_run_assignments_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.solver_run_assignments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.solver_run_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 256 (class 1259 OID 16826)
-- Name: solver_runs; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.solver_runs (
    id bigint NOT NULL,
    job_id uuid,
    schedule_id bigint,
    plan maywin_db.solver_plan NOT NULL,
    status maywin_db.solver_run_status DEFAULT 'QUEUED'::maywin_db.solver_run_status NOT NULL,
    requested_by bigint NOT NULL,
    notes text,
    attempt integer DEFAULT 1 NOT NULL,
    input_artifact_id uuid,
    output_artifact_id uuid,
    evaluation_artifact_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    failure_reason text,
    kpis_json jsonb,
    objective_value numeric(12,4),
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    nurse_stats_json jsonb,
    understaffed_json jsonb
);


ALTER TABLE maywin_db.solver_runs OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 16825)
-- Name: solver_runs_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.solver_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.solver_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 233 (class 1259 OID 16666)
-- Name: unit_memberships; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.unit_memberships (
    id bigint NOT NULL,
    unit_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.unit_memberships OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16665)
-- Name: unit_memberships_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.unit_memberships ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.unit_memberships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 231 (class 1259 OID 16652)
-- Name: units; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.units (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    site_id bigint,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.units OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16651)
-- Name: units_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.units ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 268 (class 1259 OID 34073)
-- Name: user_profiles; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.user_profiles (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    avatar_data text,
    bio text,
    phone_number text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_bucket text,
    avatar_key text,
    avatar_content_type text,
    avatar_updated_at timestamp with time zone
);


ALTER TABLE maywin_db.user_profiles OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 34072)
-- Name: user_profiles_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

CREATE SEQUENCE maywin_db.user_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE maywin_db.user_profiles_id_seq OWNER TO postgres;

--
-- TOC entry 4805 (class 0 OID 0)
-- Dependencies: 267
-- Name: user_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: maywin_db; Owner: postgres
--

ALTER SEQUENCE maywin_db.user_profiles_id_seq OWNED BY maywin_db.user_profiles.id;


--
-- TOC entry 234 (class 1259 OID 16677)
-- Name: user_roles; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.user_roles (
    user_id bigint NOT NULL,
    role_id bigint NOT NULL
);


ALTER TABLE maywin_db.user_roles OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16625)
-- Name: users; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.users (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.users OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16624)
-- Name: users_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 245 (class 1259 OID 16738)
-- Name: worker_availability; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.worker_availability (
    id bigint NOT NULL,
    worker_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    date date NOT NULL,
    shift_code text NOT NULL,
    type maywin_db.availability_type NOT NULL,
    source text NOT NULL,
    reason text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE maywin_db.worker_availability OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 16737)
-- Name: worker_availability_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.worker_availability ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.worker_availability_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 259 (class 1259 OID 17133)
-- Name: worker_messages; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.worker_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id bigint NOT NULL,
    unit_id bigint,
    worker_id bigint NOT NULL,
    sender_user_id bigint,
    sender_worker_id bigint,
    direction maywin_db.message_direction DEFAULT 'INBOUND'::maywin_db.message_direction NOT NULL,
    status maywin_db.message_status DEFAULT 'SENT'::maywin_db.message_status NOT NULL,
    subject text,
    body text NOT NULL,
    job_id uuid,
    schedule_id bigint,
    shift_date date,
    shift_code text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worker_messages_sender_chk CHECK (((sender_user_id IS NOT NULL) OR (sender_worker_id IS NOT NULL)))
);


ALTER TABLE maywin_db.worker_messages OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 16750)
-- Name: worker_preferences; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.worker_preferences (
    id bigint NOT NULL,
    worker_id bigint NOT NULL,
    prefers_day_shifts boolean,
    prefers_night_shifts boolean,
    max_consecutive_work_days integer,
    max_consecutive_night_shifts integer,
    preference_pattern_json jsonb,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    days_off_pattern_json jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE maywin_db.worker_preferences OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 16749)
-- Name: worker_preferences_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.worker_preferences ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.worker_preferences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 237 (class 1259 OID 16696)
-- Name: worker_unit_memberships; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.worker_unit_memberships (
    worker_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    role_code text
);


ALTER TABLE maywin_db.worker_unit_memberships OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 16683)
-- Name: workers; Type: TABLE; Schema: maywin_db; Owner: postgres
--

CREATE TABLE maywin_db.workers (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    primary_unit_id bigint,
    full_name text NOT NULL,
    worker_code text,
    employment_type maywin_db.employment_type,
    weekly_hours integer,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    linked_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    line_id text,
    is_backup_worker boolean DEFAULT false NOT NULL,
    max_overtime_shifts integer,
    regular_shifts_per_period integer,
    min_shifts_per_period integer
);


ALTER TABLE maywin_db.workers OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 16682)
-- Name: workers_id_seq; Type: SEQUENCE; Schema: maywin_db; Owner: postgres
--

ALTER TABLE maywin_db.workers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maywin_db.workers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 4471 (class 2604 OID 34099)
-- Name: display_settings id; Type: DEFAULT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.display_settings ALTER COLUMN id SET DEFAULT nextval('maywin_db.display_settings_id_seq'::regclass);


--
-- TOC entry 4475 (class 2604 OID 34120)
-- Name: export_options id; Type: DEFAULT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.export_options ALTER COLUMN id SET DEFAULT nextval('maywin_db.export_options_id_seq'::regclass);


--
-- TOC entry 4455 (class 2604 OID 24607)
-- Name: migrations id; Type: DEFAULT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.migrations ALTER COLUMN id SET DEFAULT nextval('maywin_db.migrations_id_seq'::regclass);


--
-- TOC entry 4456 (class 2604 OID 24616)
-- Name: schedule_runs id; Type: DEFAULT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_runs ALTER COLUMN id SET DEFAULT nextval('maywin_db.schedule_runs_id_seq'::regclass);


--
-- TOC entry 4467 (class 2604 OID 34076)
-- Name: user_profiles id; Type: DEFAULT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.user_profiles ALTER COLUMN id SET DEFAULT nextval('maywin_db.user_profiles_id_seq'::regclass);


--
-- TOC entry 4564 (class 2606 OID 24611)
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- TOC entry 4574 (class 2606 OID 32803)
-- Name: auth_otps auth_otps_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.auth_otps
    ADD CONSTRAINT auth_otps_pkey PRIMARY KEY (id);


--
-- TOC entry 4568 (class 2606 OID 24642)
-- Name: chatbot_conversations chatbot_conversations_line_user_id_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_line_user_id_key UNIQUE (line_user_id);


--
-- TOC entry 4570 (class 2606 OID 24640)
-- Name: chatbot_conversations chatbot_conversations_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_pkey PRIMARY KEY (id);


--
-- TOC entry 4522 (class 2606 OID 16736)
-- Name: constraint_profiles constraint_profiles_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.constraint_profiles
    ADD CONSTRAINT constraint_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4519 (class 2606 OID 16725)
-- Name: coverage_rules coverage_rules_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.coverage_rules
    ADD CONSTRAINT coverage_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4587 (class 2606 OID 34106)
-- Name: display_settings display_settings_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.display_settings
    ADD CONSTRAINT display_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4589 (class 2606 OID 34108)
-- Name: display_settings display_settings_user_id_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.display_settings
    ADD CONSTRAINT display_settings_user_id_key UNIQUE (user_id);


--
-- TOC entry 4592 (class 2606 OID 34127)
-- Name: export_options export_options_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.export_options
    ADD CONSTRAINT export_options_pkey PRIMARY KEY (id);


--
-- TOC entry 4594 (class 2606 OID 34129)
-- Name: export_options export_options_user_id_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.export_options
    ADD CONSTRAINT export_options_user_id_key UNIQUE (user_id);


--
-- TOC entry 4578 (class 2606 OID 32818)
-- Name: line_link_tokens line_link_tokens_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.line_link_tokens
    ADD CONSTRAINT line_link_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4580 (class 2606 OID 32820)
-- Name: line_link_tokens line_link_tokens_token_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.line_link_tokens
    ADD CONSTRAINT line_link_tokens_token_key UNIQUE (token);


--
-- TOC entry 4481 (class 2606 OID 16612)
-- Name: organizations organizations_code_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.organizations
    ADD CONSTRAINT organizations_code_key UNIQUE (code);


--
-- TOC entry 4483 (class 2606 OID 16610)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4485 (class 2606 OID 16623)
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- TOC entry 4487 (class 2606 OID 16621)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 4547 (class 2606 OID 33624)
-- Name: schedule_assignments sa_run_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_assignments
    ADD CONSTRAINT sa_run_uniq UNIQUE (schedule_run_id, worker_id, date, shift_order);


--
-- TOC entry 4538 (class 2606 OID 16785)
-- Name: schedule_artifacts schedule_artifacts_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_artifacts
    ADD CONSTRAINT schedule_artifacts_pkey PRIMARY KEY (id);


--
-- TOC entry 4549 (class 2606 OID 16822)
-- Name: schedule_assignments schedule_assignments_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_assignments
    ADD CONSTRAINT schedule_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 4541 (class 2606 OID 16796)
-- Name: schedule_job_events schedule_job_events_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_job_events
    ADD CONSTRAINT schedule_job_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4534 (class 2606 OID 16772)
-- Name: schedule_jobs schedule_jobs_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_jobs
    ADD CONSTRAINT schedule_jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 4566 (class 2606 OID 24619)
-- Name: schedule_runs schedule_runs_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_runs
    ADD CONSTRAINT schedule_runs_pkey PRIMARY KEY (id);


--
-- TOC entry 4543 (class 2606 OID 16809)
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 4515 (class 2606 OID 16713)
-- Name: shift_templates shift_templates_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.shift_templates
    ADD CONSTRAINT shift_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 4493 (class 2606 OID 16650)
-- Name: sites sites_org_code_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.sites
    ADD CONSTRAINT sites_org_code_uniq UNIQUE (organization_id, code);


--
-- TOC entry 4495 (class 2606 OID 16648)
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- TOC entry 4555 (class 2606 OID 16846)
-- Name: solver_run_assignments solver_run_assignments_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_run_assignments
    ADD CONSTRAINT solver_run_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 4552 (class 2606 OID 16836)
-- Name: solver_runs solver_runs_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_runs
    ADD CONSTRAINT solver_runs_pkey PRIMARY KEY (id);


--
-- TOC entry 4557 (class 2606 OID 16848)
-- Name: solver_run_assignments sra_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_run_assignments
    ADD CONSTRAINT sra_uniq UNIQUE (solver_run_id, worker_id, date);


--
-- TOC entry 4517 (class 2606 OID 16715)
-- Name: shift_templates st_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.shift_templates
    ADD CONSTRAINT st_uniq UNIQUE (organization_id, unit_id, code);


--
-- TOC entry 4501 (class 2606 OID 16676)
-- Name: unit_memberships um_unit_user_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.unit_memberships
    ADD CONSTRAINT um_unit_user_uniq UNIQUE (unit_id, user_id);


--
-- TOC entry 4503 (class 2606 OID 16674)
-- Name: unit_memberships unit_memberships_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.unit_memberships
    ADD CONSTRAINT unit_memberships_pkey PRIMARY KEY (id);


--
-- TOC entry 4497 (class 2606 OID 16664)
-- Name: units units_org_code_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.units
    ADD CONSTRAINT units_org_code_uniq UNIQUE (organization_id, code);


--
-- TOC entry 4499 (class 2606 OID 16662)
-- Name: units units_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- TOC entry 4583 (class 2606 OID 34083)
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4585 (class 2606 OID 34085)
-- Name: user_profiles user_profiles_user_id_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.user_profiles
    ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 4505 (class 2606 OID 16681)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- TOC entry 4489 (class 2606 OID 16637)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4491 (class 2606 OID 16635)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4525 (class 2606 OID 16748)
-- Name: worker_availability wa_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_availability
    ADD CONSTRAINT wa_uniq UNIQUE (worker_id, unit_id, date, shift_code);


--
-- TOC entry 4527 (class 2606 OID 16746)
-- Name: worker_availability worker_availability_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_availability
    ADD CONSTRAINT worker_availability_pkey PRIMARY KEY (id);


--
-- TOC entry 4562 (class 2606 OID 17146)
-- Name: worker_messages worker_messages_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_messages
    ADD CONSTRAINT worker_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 4529 (class 2606 OID 16758)
-- Name: worker_preferences worker_preferences_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_preferences
    ADD CONSTRAINT worker_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 4531 (class 2606 OID 16760)
-- Name: worker_preferences worker_preferences_worker_id_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_preferences
    ADD CONSTRAINT worker_preferences_worker_id_key UNIQUE (worker_id);


--
-- TOC entry 4513 (class 2606 OID 16702)
-- Name: worker_unit_memberships worker_unit_memberships_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_unit_memberships
    ADD CONSTRAINT worker_unit_memberships_pkey PRIMARY KEY (worker_id, unit_id);


--
-- TOC entry 4507 (class 2606 OID 24646)
-- Name: workers workers_line_id_key; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.workers
    ADD CONSTRAINT workers_line_id_key UNIQUE (line_id);


--
-- TOC entry 4509 (class 2606 OID 16695)
-- Name: workers workers_org_code_uniq; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.workers
    ADD CONSTRAINT workers_org_code_uniq UNIQUE (organization_id, worker_code);


--
-- TOC entry 4511 (class 2606 OID 16693)
-- Name: workers workers_pkey; Type: CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (id);


--
-- TOC entry 4590 (class 1259 OID 34114)
-- Name: idx_display_settings_user_id; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX idx_display_settings_user_id ON maywin_db.display_settings USING btree (user_id);


--
-- TOC entry 4581 (class 1259 OID 34091)
-- Name: idx_user_profiles_user_id; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX idx_user_profiles_user_id ON maywin_db.user_profiles USING btree (user_id);


--
-- TOC entry 4575 (class 1259 OID 32809)
-- Name: ix_auth_otps_user_id; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_auth_otps_user_id ON maywin_db.auth_otps USING btree (user_id);


--
-- TOC entry 4571 (class 1259 OID 24643)
-- Name: ix_chatbot_conversations_line_user_id; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_chatbot_conversations_line_user_id ON maywin_db.chatbot_conversations USING btree (line_user_id);


--
-- TOC entry 4572 (class 1259 OID 24644)
-- Name: ix_chatbot_conversations_worker_id; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_chatbot_conversations_worker_id ON maywin_db.chatbot_conversations USING btree (worker_id) WHERE (worker_id IS NOT NULL);


--
-- TOC entry 4520 (class 1259 OID 16849)
-- Name: ix_coverage_rules_unit; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_coverage_rules_unit ON maywin_db.coverage_rules USING btree (unit_id);


--
-- TOC entry 4576 (class 1259 OID 32826)
-- Name: ix_line_link_tokens_worker_id; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_line_link_tokens_worker_id ON maywin_db.line_link_tokens USING btree (worker_id);


--
-- TOC entry 4536 (class 1259 OID 16786)
-- Name: ix_schedule_artifacts_job_type; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_schedule_artifacts_job_type ON maywin_db.schedule_artifacts USING btree (job_id, type, created_at DESC);


--
-- TOC entry 4545 (class 1259 OID 16851)
-- Name: ix_schedule_assignments_schedule; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_schedule_assignments_schedule ON maywin_db.schedule_assignments USING btree (schedule_id);


--
-- TOC entry 4539 (class 1259 OID 16797)
-- Name: ix_schedule_job_events_job_time; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_schedule_job_events_job_time ON maywin_db.schedule_job_events USING btree (job_id, created_at DESC);


--
-- TOC entry 4532 (class 1259 OID 16774)
-- Name: ix_schedule_jobs_unit_status; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_schedule_jobs_unit_status ON maywin_db.schedule_jobs USING btree (unit_id, status, created_at DESC);


--
-- TOC entry 4550 (class 1259 OID 16852)
-- Name: ix_solver_runs_job; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_solver_runs_job ON maywin_db.solver_runs USING btree (job_id);


--
-- TOC entry 4523 (class 1259 OID 16850)
-- Name: ix_worker_availability_worker_date; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_worker_availability_worker_date ON maywin_db.worker_availability USING btree (worker_id, date);


--
-- TOC entry 4558 (class 1259 OID 17149)
-- Name: ix_worker_messages_job_time; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_worker_messages_job_time ON maywin_db.worker_messages USING btree (job_id, created_at DESC) WHERE (job_id IS NOT NULL);


--
-- TOC entry 4559 (class 1259 OID 17148)
-- Name: ix_worker_messages_unit_time; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_worker_messages_unit_time ON maywin_db.worker_messages USING btree (unit_id, created_at DESC) WHERE (unit_id IS NOT NULL);


--
-- TOC entry 4560 (class 1259 OID 17147)
-- Name: ix_worker_messages_worker_time; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE INDEX ix_worker_messages_worker_time ON maywin_db.worker_messages USING btree (worker_id, created_at DESC);


--
-- TOC entry 4535 (class 1259 OID 16773)
-- Name: uq_schedule_jobs_idempotency; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE UNIQUE INDEX uq_schedule_jobs_idempotency ON maywin_db.schedule_jobs USING btree (unit_id, requested_by, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- TOC entry 4544 (class 1259 OID 16810)
-- Name: uq_schedules_job_id; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE UNIQUE INDEX uq_schedules_job_id ON maywin_db.schedules USING btree (job_id) WHERE (job_id IS NOT NULL);


--
-- TOC entry 4553 (class 1259 OID 16837)
-- Name: uq_solver_runs_job_plan; Type: INDEX; Schema: maywin_db; Owner: postgres
--

CREATE UNIQUE INDEX uq_solver_runs_job_plan ON maywin_db.solver_runs USING btree (job_id, plan) WHERE (job_id IS NOT NULL);


--
-- TOC entry 4645 (class 2606 OID 32804)
-- Name: auth_otps auth_otps_user_id_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.auth_otps
    ADD CONSTRAINT auth_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES maywin_db.users(id) ON DELETE CASCADE;


--
-- TOC entry 4643 (class 2606 OID 34002)
-- Name: chatbot_conversations chatbot_conversations_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE SET NULL;


--
-- TOC entry 4644 (class 2606 OID 34032)
-- Name: chatbot_conversations chatbot_conversations_unit_id_units_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_unit_id_units_fkey FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE SET NULL;


--
-- TOC entry 4611 (class 2606 OID 34007)
-- Name: constraint_profiles constraint_profiles_org_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.constraint_profiles
    ADD CONSTRAINT constraint_profiles_org_id_organizations_fkey FOREIGN KEY (org_id) REFERENCES maywin_db.organizations(id) ON DELETE SET NULL;


--
-- TOC entry 4612 (class 2606 OID 16933)
-- Name: constraint_profiles cp_unit_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.constraint_profiles
    ADD CONSTRAINT cp_unit_fk FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE CASCADE;


--
-- TOC entry 4610 (class 2606 OID 16928)
-- Name: coverage_rules cr_unit_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.coverage_rules
    ADD CONSTRAINT cr_unit_fk FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE CASCADE;


--
-- TOC entry 4648 (class 2606 OID 34109)
-- Name: display_settings fk_display_settings_user; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.display_settings
    ADD CONSTRAINT fk_display_settings_user FOREIGN KEY (user_id) REFERENCES maywin_db.users(id) ON DELETE CASCADE;


--
-- TOC entry 4647 (class 2606 OID 34086)
-- Name: user_profiles fk_user_profile_user; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.user_profiles
    ADD CONSTRAINT fk_user_profile_user FOREIGN KEY (user_id) REFERENCES maywin_db.users(id) ON DELETE CASCADE;


--
-- TOC entry 4646 (class 2606 OID 32821)
-- Name: line_link_tokens line_link_tokens_worker_id_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.line_link_tokens
    ADD CONSTRAINT line_link_tokens_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES maywin_db.workers(id) ON DELETE CASCADE;


--
-- TOC entry 4620 (class 2606 OID 17038)
-- Name: schedule_artifacts s_art_job_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_artifacts
    ADD CONSTRAINT s_art_job_fk FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs(id) ON DELETE CASCADE;


--
-- TOC entry 4621 (class 2606 OID 17043)
-- Name: schedule_job_events s_evt_job_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_job_events
    ADD CONSTRAINT s_evt_job_fk FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs(id) ON DELETE CASCADE;


--
-- TOC entry 4628 (class 2606 OID 16978)
-- Name: schedule_assignments sa_schedule_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_assignments
    ADD CONSTRAINT sa_schedule_fk FOREIGN KEY (schedule_id) REFERENCES maywin_db.schedules(id) ON DELETE CASCADE;


--
-- TOC entry 4622 (class 2606 OID 16973)
-- Name: schedules sch_cp_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedules
    ADD CONSTRAINT sch_cp_fk FOREIGN KEY (constraint_profile_id) REFERENCES maywin_db.constraint_profiles(id);


--
-- TOC entry 4623 (class 2606 OID 16963)
-- Name: schedules sch_created_by_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedules
    ADD CONSTRAINT sch_created_by_fk FOREIGN KEY (created_by) REFERENCES maywin_db.users(id);


--
-- TOC entry 4624 (class 2606 OID 17028)
-- Name: schedules sch_job_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedules
    ADD CONSTRAINT sch_job_fk FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs(id) ON DELETE SET NULL;


--
-- TOC entry 4625 (class 2606 OID 16968)
-- Name: schedules sch_published_by_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedules
    ADD CONSTRAINT sch_published_by_fk FOREIGN KEY (published_by) REFERENCES maywin_db.users(id);


--
-- TOC entry 4629 (class 2606 OID 34057)
-- Name: schedule_assignments schedule_assignments_worker_id_workers_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_assignments
    ADD CONSTRAINT schedule_assignments_worker_id_workers_fkey FOREIGN KEY (worker_id) REFERENCES maywin_db.workers(id) ON DELETE CASCADE;


--
-- TOC entry 4616 (class 2606 OID 33997)
-- Name: schedule_jobs schedule_jobs_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_jobs
    ADD CONSTRAINT schedule_jobs_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4626 (class 2606 OID 33992)
-- Name: schedules schedules_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedules
    ADD CONSTRAINT schedules_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4627 (class 2606 OID 34042)
-- Name: schedules schedules_unit_id_units_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedules
    ADD CONSTRAINT schedules_unit_id_units_fkey FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE SET NULL;


--
-- TOC entry 4608 (class 2606 OID 33987)
-- Name: shift_templates shift_templates_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.shift_templates
    ADD CONSTRAINT shift_templates_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4609 (class 2606 OID 34037)
-- Name: shift_templates shift_templates_unit_id_units_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.shift_templates
    ADD CONSTRAINT shift_templates_unit_id_units_fkey FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE SET NULL;


--
-- TOC entry 4596 (class 2606 OID 33962)
-- Name: sites sites_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.sites
    ADD CONSTRAINT sites_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4617 (class 2606 OID 17023)
-- Name: schedule_jobs sj_final_schedule_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_jobs
    ADD CONSTRAINT sj_final_schedule_fk FOREIGN KEY (final_schedule_id) REFERENCES maywin_db.schedules(id) ON DELETE SET NULL;


--
-- TOC entry 4618 (class 2606 OID 17018)
-- Name: schedule_jobs sj_requested_by_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_jobs
    ADD CONSTRAINT sj_requested_by_fk FOREIGN KEY (requested_by) REFERENCES maywin_db.users(id);


--
-- TOC entry 4619 (class 2606 OID 17013)
-- Name: schedule_jobs sj_unit_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.schedule_jobs
    ADD CONSTRAINT sj_unit_fk FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id);


--
-- TOC entry 4630 (class 2606 OID 17058)
-- Name: solver_runs sr_eval_artifact_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_runs
    ADD CONSTRAINT sr_eval_artifact_fk FOREIGN KEY (evaluation_artifact_id) REFERENCES maywin_db.schedule_artifacts(id) ON DELETE SET NULL;


--
-- TOC entry 4631 (class 2606 OID 17048)
-- Name: solver_runs sr_input_artifact_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_runs
    ADD CONSTRAINT sr_input_artifact_fk FOREIGN KEY (input_artifact_id) REFERENCES maywin_db.schedule_artifacts(id) ON DELETE SET NULL;


--
-- TOC entry 4632 (class 2606 OID 17033)
-- Name: solver_runs sr_job_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_runs
    ADD CONSTRAINT sr_job_fk FOREIGN KEY (job_id) REFERENCES maywin_db.schedule_jobs(id) ON DELETE SET NULL;


--
-- TOC entry 4633 (class 2606 OID 17053)
-- Name: solver_runs sr_output_artifact_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_runs
    ADD CONSTRAINT sr_output_artifact_fk FOREIGN KEY (output_artifact_id) REFERENCES maywin_db.schedule_artifacts(id) ON DELETE SET NULL;


--
-- TOC entry 4634 (class 2606 OID 16993)
-- Name: solver_runs sr_requested_by_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_runs
    ADD CONSTRAINT sr_requested_by_fk FOREIGN KEY (requested_by) REFERENCES maywin_db.users(id);


--
-- TOC entry 4635 (class 2606 OID 16988)
-- Name: solver_runs sr_schedule_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_runs
    ADD CONSTRAINT sr_schedule_fk FOREIGN KEY (schedule_id) REFERENCES maywin_db.schedules(id) ON DELETE CASCADE;


--
-- TOC entry 4636 (class 2606 OID 16998)
-- Name: solver_run_assignments sra_run_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_run_assignments
    ADD CONSTRAINT sra_run_fk FOREIGN KEY (solver_run_id) REFERENCES maywin_db.solver_runs(id) ON DELETE CASCADE;


--
-- TOC entry 4637 (class 2606 OID 17003)
-- Name: solver_run_assignments sra_worker_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.solver_run_assignments
    ADD CONSTRAINT sra_worker_fk FOREIGN KEY (worker_id) REFERENCES maywin_db.workers(id);


--
-- TOC entry 4599 (class 2606 OID 16873)
-- Name: unit_memberships um_unit_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.unit_memberships
    ADD CONSTRAINT um_unit_fk FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE CASCADE;


--
-- TOC entry 4600 (class 2606 OID 16878)
-- Name: unit_memberships um_user_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.unit_memberships
    ADD CONSTRAINT um_user_fk FOREIGN KEY (user_id) REFERENCES maywin_db.users(id) ON DELETE CASCADE;


--
-- TOC entry 4597 (class 2606 OID 33967)
-- Name: units units_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.units
    ADD CONSTRAINT units_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4598 (class 2606 OID 34012)
-- Name: units units_site_id_sites_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.units
    ADD CONSTRAINT units_site_id_sites_fkey FOREIGN KEY (site_id) REFERENCES maywin_db.sites(id) ON DELETE SET NULL;


--
-- TOC entry 4601 (class 2606 OID 16888)
-- Name: user_roles ur_role_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.user_roles
    ADD CONSTRAINT ur_role_fk FOREIGN KEY (role_id) REFERENCES maywin_db.roles(id) ON DELETE CASCADE;


--
-- TOC entry 4602 (class 2606 OID 16883)
-- Name: user_roles ur_user_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.user_roles
    ADD CONSTRAINT ur_user_fk FOREIGN KEY (user_id) REFERENCES maywin_db.users(id) ON DELETE CASCADE;


--
-- TOC entry 4595 (class 2606 OID 33972)
-- Name: users users_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.users
    ADD CONSTRAINT users_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4613 (class 2606 OID 16938)
-- Name: worker_availability wa_worker_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_availability
    ADD CONSTRAINT wa_worker_fk FOREIGN KEY (worker_id) REFERENCES maywin_db.workers(id) ON DELETE CASCADE;


--
-- TOC entry 4614 (class 2606 OID 34017)
-- Name: worker_availability worker_availability_unit_id_units_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_availability
    ADD CONSTRAINT worker_availability_unit_id_units_fkey FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE CASCADE;


--
-- TOC entry 4638 (class 2606 OID 33982)
-- Name: worker_messages worker_messages_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_messages
    ADD CONSTRAINT worker_messages_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4639 (class 2606 OID 34067)
-- Name: worker_messages worker_messages_sender_user_id_users_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_messages
    ADD CONSTRAINT worker_messages_sender_user_id_users_fkey FOREIGN KEY (sender_user_id) REFERENCES maywin_db.users(id) ON DELETE SET NULL;


--
-- TOC entry 4640 (class 2606 OID 34052)
-- Name: worker_messages worker_messages_sender_worker_id_workers_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_messages
    ADD CONSTRAINT worker_messages_sender_worker_id_workers_fkey FOREIGN KEY (sender_worker_id) REFERENCES maywin_db.workers(id) ON DELETE SET NULL;


--
-- TOC entry 4641 (class 2606 OID 34027)
-- Name: worker_messages worker_messages_unit_id_units_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_messages
    ADD CONSTRAINT worker_messages_unit_id_units_fkey FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE SET NULL;


--
-- TOC entry 4642 (class 2606 OID 34047)
-- Name: worker_messages worker_messages_worker_id_workers_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_messages
    ADD CONSTRAINT worker_messages_worker_id_workers_fkey FOREIGN KEY (worker_id) REFERENCES maywin_db.workers(id) ON DELETE CASCADE;


--
-- TOC entry 4603 (class 2606 OID 34062)
-- Name: workers workers_linked_user_id_users_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.workers
    ADD CONSTRAINT workers_linked_user_id_users_fkey FOREIGN KEY (linked_user_id) REFERENCES maywin_db.users(id) ON DELETE SET NULL;


--
-- TOC entry 4604 (class 2606 OID 33977)
-- Name: workers workers_organization_id_organizations_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.workers
    ADD CONSTRAINT workers_organization_id_organizations_fkey FOREIGN KEY (organization_id) REFERENCES maywin_db.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4605 (class 2606 OID 34022)
-- Name: workers workers_primary_unit_id_units_fkey; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.workers
    ADD CONSTRAINT workers_primary_unit_id_units_fkey FOREIGN KEY (primary_unit_id) REFERENCES maywin_db.units(id) ON DELETE SET NULL;


--
-- TOC entry 4615 (class 2606 OID 16948)
-- Name: worker_preferences wp_worker_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_preferences
    ADD CONSTRAINT wp_worker_fk FOREIGN KEY (worker_id) REFERENCES maywin_db.workers(id) ON DELETE CASCADE;


--
-- TOC entry 4606 (class 2606 OID 16913)
-- Name: worker_unit_memberships wum_unit_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_unit_memberships
    ADD CONSTRAINT wum_unit_fk FOREIGN KEY (unit_id) REFERENCES maywin_db.units(id) ON DELETE CASCADE;


--
-- TOC entry 4607 (class 2606 OID 16908)
-- Name: worker_unit_memberships wum_worker_fk; Type: FK CONSTRAINT; Schema: maywin_db; Owner: postgres
--

ALTER TABLE ONLY maywin_db.worker_unit_memberships
    ADD CONSTRAINT wum_worker_fk FOREIGN KEY (worker_id) REFERENCES maywin_db.workers(id) ON DELETE CASCADE;


-- Completed on 2026-04-22 11:07:55

--
-- PostgreSQL database dump complete
--
