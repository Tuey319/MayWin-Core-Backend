-- ============================================================================
-- Database Seeding SQL for Schedule Generation Testing
-- ============================================================================
-- This SQL script creates minimal data required to run a schedule generation.
-- Execute this in your PostgreSQL database (maywin schema).
--
-- After running, you can trigger the orchestrator via API.
-- ============================================================================

-- Set schema
SET search_path TO maywin_db;

-- ============================================================================
-- 1. ORGANIZATION
-- ============================================================================
INSERT INTO maywin_db.organizations (name, code, timezone, attributes, created_at, updated_at)
VALUES (
  'Demo Hospital',
  'DEMO_HOSPITAL',
  'Asia/Bangkok',
  '{"description": "Demo organization for testing solver"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO NOTHING
RETURNING id;

-- Store organization ID (use the actual ID from above or query it)
-- For this example, assuming ID = 1

-- ============================================================================
-- 2. SITE
-- ============================================================================
INSERT INTO maywin_db.sites (organization_id, name, code, address, timezone, is_active, attributes, created_at)
VALUES (
  1, -- organization_id
  'Main Campus',
  'MAIN_CAMPUS',
  '123 Hospital Road, Bangkok',
  'Asia/Bangkok',
  true,
  '{}'::jsonb,
  NOW()
)
ON CONFLICT ON CONSTRAINT sites_org_code_uniq DO NOTHING;

-- ============================================================================
-- 3. UNIT
-- ============================================================================
INSERT INTO maywin_db.units (organization_id, site_id, name, code, description, is_active, attributes, created_at, updated_at)
VALUES (
  1, -- organization_id
  1, -- site_id
  'Intensive Care Unit 1',
  'ICU_01',
  'Primary ICU for critical care',
  true,
  '{"capacity": 20, "specialty": "Critical Care"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT units_org_code_uniq DO NOTHING;

-- ============================================================================
-- 4. USER (Admin)
-- ============================================================================
-- Password: password123 (bcrypt hash)
-- You'll need to generate a proper bcrypt hash or use the TypeScript seeder
INSERT INTO maywin_db.users (organization_id, email, password_hash, full_name, is_active, attributes, created_at, updated_at)
VALUES (
  1,
  'admin@demo.com',
  '$2b$10$XOPbrlUPQdwdJUpSrIF6X.LbE6keoFaHCLnvM0A6MDhm5G4lW1sMW', -- password123
  'Admin User',
  true,
  '{}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 5. WORKERS (8 Nurses)
-- ============================================================================
INSERT INTO maywin_db.workers (organization_id, primary_unit_id, full_name, worker_code, employment_type, weekly_hours, is_active, attributes, created_at, updated_at)
VALUES
  (1, 1, 'Nurse N001', 'N001', 'FULL_TIME', 40, true, '{"skill_level": "SENIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW()),
  (1, 1, 'Nurse N002', 'N002', 'FULL_TIME', 40, true, '{"skill_level": "SENIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW()),
  (1, 1, 'Nurse N003', 'N003', 'FULL_TIME', 40, true, '{"skill_level": "SENIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW()),
  (1, 1, 'Nurse N004', 'N004', 'FULL_TIME', 40, true, '{"skill_level": "SENIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW()),
  (1, 1, 'Nurse N005', 'N005', 'FULL_TIME', 40, true, '{"skill_level": "JUNIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW()),
  (1, 1, 'Nurse N006', 'N006', 'FULL_TIME', 40, true, '{"skill_level": "JUNIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW()),
  (1, 1, 'Nurse N007', 'N007', 'FULL_TIME', 40, true, '{"skill_level": "JUNIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW()),
  (1, 1, 'Nurse N008', 'N008', 'FULL_TIME', 40, true, '{"skill_level": "JUNIOR", "certifications": ["BLS", "ACLS"]}'::jsonb, NOW(), NOW())
ON CONFLICT ON CONSTRAINT workers_org_code_uniq DO NOTHING;

-- ============================================================================
-- 6. WORKER-UNIT MEMBERSHIPS
-- ============================================================================
-- Assuming worker IDs are 1-8 (adjust if needed)
INSERT INTO maywin_db.worker_unit_memberships (worker_id, unit_id, role_code)
VALUES
  (1, 1, 'NURSE'),
  (2, 1, 'NURSE'),
  (3, 1, 'NURSE'),
  (4, 1, 'NURSE'),
  (5, 1, 'NURSE'),
  (6, 1, 'NURSE'),
  (7, 1, 'NURSE'),
  (8, 1, 'NURSE')
ON CONFLICT (worker_id, unit_id) DO NOTHING;

-- ============================================================================
-- 7. SHIFT TEMPLATES
-- ============================================================================
INSERT INTO maywin_db.shift_templates (organization_id, unit_id, code, name, start_time, end_time, is_active, attributes, created_at)
VALUES
  (1, 1, 'DAY', 'Day Shift', '07:00:00', '15:00:00', true, '{"is_rest": false, "duration_hours": 8}'::jsonb, NOW()),
  (1, 1, 'EVENING', 'Evening Shift', '15:00:00', '23:00:00', true, '{"is_rest": false, "duration_hours": 8}'::jsonb, NOW()),
  (1, 1, 'NIGHT', 'Night Shift', '23:00:00', '07:00:00', true, '{"is_rest": false, "duration_hours": 8}'::jsonb, NOW()),
  (1, 1, 'OFF', 'Off Day', '00:00:00', '00:00:00', true, '{"is_rest": true, "duration_hours": 0}'::jsonb, NOW())
ON CONFLICT ON CONSTRAINT st_uniq DO NOTHING;

-- ============================================================================
-- 8. COVERAGE RULES
-- ============================================================================
INSERT INTO maywin_db.coverage_rules (unit_id, shift_code, day_type, min_workers, max_workers, required_tag, attributes, created_at)
VALUES
  -- Weekday coverage
  (1, 'DAY', 'WEEKDAY', 3, 4, NULL, '{}'::jsonb, NOW()),
  (1, 'EVENING', 'WEEKDAY', 2, 3, NULL, '{}'::jsonb, NOW()),
  (1, 'NIGHT', 'WEEKDAY', 2, 3, NULL, '{}'::jsonb, NOW()),
  
  -- Weekend coverage
  (1, 'DAY', 'WEEKEND', 2, 3, NULL, '{}'::jsonb, NOW()),
  (1, 'EVENING', 'WEEKEND', 2, 2, NULL, '{}'::jsonb, NOW()),
  (1, 'NIGHT', 'WEEKEND', 2, 2, NULL, '{}'::jsonb, NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. CONSTRAINT PROFILE
-- ============================================================================
INSERT INTO maywin_db.constraint_profiles (
  unit_id, 
  name, 
  max_consecutive_work_days, 
  max_consecutive_night_shifts, 
  min_rest_hours_between_shifts,
  fairness_weight_json,
  penalty_weight_json,
  is_active,
  attributes,
  created_at
)
VALUES (
  1,
  'Default ICU Constraints',
  5,  -- max 5 consecutive work days
  3,  -- max 3 consecutive night shifts
  12, -- min 12 hours rest between shifts
  '{"shift_distribution": 1.0, "workload_balance": 1.0}'::jsonb,
  '{"consecutive_days_penalty": 5, "night_shift_penalty": 2}'::jsonb,
  true,
  '{"description": "Standard constraints for ICU scheduling"}'::jsonb,
  NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. SCHEDULE CONTAINER
-- ============================================================================
INSERT INTO maywin_db.schedules (
  organization_id,
  unit_id,
  name,
  start_date,
  end_date,
  status,
  constraint_profile_id,
  created_by,
  job_id,
  last_solver_run_id,
  attributes,
  created_at
)
VALUES (
  1,
  1,
  'ICU Schedule Week 2026-02-17',
  '2026-02-17',
  '2026-02-23',
  'DRAFT',
  1, -- constraint_profile_id
  1, -- created_by (admin user id)
  NULL,
  NULL,
  '{"notes": "Demo schedule for solver testing"}'::jsonb,
  NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. WORKER AVAILABILITY (Optional but recommended)
-- ============================================================================
-- Make all workers available for all shifts on the start date
-- Note: WorkerAvailability tracks per-shift, per-day availability
-- Type options: AVAILABLE, UNAVAILABLE, PREFERRED, AVOID
INSERT INTO maywin_db.worker_availability (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
VALUES
  -- Worker 1 (N001)
  (1, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (1, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (1, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  
  -- Worker 2 (N002)
  (2, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (2, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (2, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  
  -- Worker 3 (N003)
  (3, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (3, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (3, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  
  -- Worker 4 (N004)
  (4, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (4, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (4, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  
  -- Worker 5 (N005)
  (5, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (5, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (5, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  
  -- Worker 6 (N006)
  (6, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (6, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (6, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  
  -- Worker 7 (N007)
  (7, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (7, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (7, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  
  -- Worker 8 (N008)
  (8, 1, '2026-02-17', 'DAY', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (8, 1, '2026-02-17', 'EVENING', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb),
  (8, 1, '2026-02-17', 'NIGHT', 'AVAILABLE', 'SEED', NULL, '{}'::jsonb)
ON CONFLICT ON CONSTRAINT wa_uniq DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
SELECT '✓ Organization' as status, COUNT(*) as count FROM maywin_db.organizations WHERE code = 'DEMO_HOSPITAL';
SELECT '✓ Site' as status, COUNT(*) as count FROM maywin_db.sites WHERE code = 'MAIN_CAMPUS';
SELECT '✓ Unit' as status, COUNT(*) as count FROM maywin_db.units WHERE code = 'ICU_01';
SELECT '✓ User' as status, COUNT(*) as count FROM maywin_db.users WHERE email = 'admin@demo.com';
SELECT '✓ Workers' as status, COUNT(*) as count FROM maywin_db.workers WHERE organization_id = 1;
SELECT '✓ Shift Templates' as status, COUNT(*) as count FROM maywin_db.shift_templates WHERE unit_id = 1;
SELECT '✓ Coverage Rules' as status, COUNT(*) as count FROM maywin_db.coverage_rules WHERE unit_id = 1;
SELECT '✓ Constraint Profile' as status, COUNT(*) as count FROM maywin_db.constraint_profiles WHERE unit_id = 1;
SELECT '✓ Schedule' as status, id, start_date, end_date FROM maywin_db.schedules WHERE unit_id = 1 LIMIT 1;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- After running this script, you should have:
--   - 1 Organization (DEMO_HOSPITAL)
--   - 1 Site (MAIN_CAMPUS)
--   - 1 Unit (ICU_01)
--   - 1 Admin User (admin@demo.com / password123)
--   - 8 Workers (N001-N008)
--   - 4 Shift Templates (DAY, EVENING, NIGHT, OFF)
--   - 6 Coverage Rules (weekday + weekend)
--   - 1 Constraint Profile
--   - 1 Schedule (2026-02-17 to 2026-02-23)
--
-- Next steps:
--   1. Login: POST /api/v1/core/auth/login with admin@demo.com
--   2. Run solver: POST /api/v1/core/orchestrator/run with the schedule ID
-- ============================================================================
