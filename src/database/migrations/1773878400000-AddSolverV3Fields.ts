import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Solver v3 (app3.py) support
 *
 * Adds columns required by the upgraded OR-Tools solver:
 *   - workers: backup flag, overtime/shift period limits
 *   - constraint_profiles: full Rules + Weights + GoalPriority + FairnessWeights
 *   - schedule_assignments: emergency_override flag
 *   - solver_run_assignments: emergency_override flag
 *   - solver_runs: nurse_stats_json, understaffed_json
 */
export class AddSolverV3Fields1773878400000 implements MigrationInterface {
  name = 'AddSolverV3Fields1773878400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── workers ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        ADD COLUMN IF NOT EXISTS is_backup_worker boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS max_overtime_shifts int,
        ADD COLUMN IF NOT EXISTS regular_shifts_per_period int,
        ADD COLUMN IF NOT EXISTS min_shifts_per_period int
    `);

    // ── constraint_profiles ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE maywin_db.constraint_profiles
        -- daily / weekly limits
        ADD COLUMN IF NOT EXISTS max_shifts_per_day int NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS min_days_off_per_week int NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS max_nights_per_week int NOT NULL DEFAULT 2,
        -- shift-sequence toggles
        ADD COLUMN IF NOT EXISTS forbid_night_to_morning boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS forbid_morning_to_night_same_day boolean NOT NULL DEFAULT false,
        -- coverage / emergency
        ADD COLUMN IF NOT EXISTS guarantee_full_coverage boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS allow_emergency_overrides boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS allow_second_shift_same_day_in_emergency boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS ignore_availability_in_emergency boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS allow_night_cap_override_in_emergency boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS allow_rest_rule_override_in_emergency boolean NOT NULL DEFAULT true,
        -- goal toggles
        ADD COLUMN IF NOT EXISTS goal_minimize_staff_cost boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS goal_maximize_preference_satisfaction boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS goal_balance_workload boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS goal_balance_night_workload boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS goal_reduce_undesirable_shifts boolean NOT NULL DEFAULT true,
        -- goal priority json
        ADD COLUMN IF NOT EXISTS goal_priority_json jsonb,
        -- solver execution tuning
        ADD COLUMN IF NOT EXISTS num_search_workers int NOT NULL DEFAULT 8,
        ADD COLUMN IF NOT EXISTS time_limit_sec real NOT NULL DEFAULT 20
    `);

    // ── schedule_assignments ─────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
        ADD COLUMN IF NOT EXISTS emergency_override boolean NOT NULL DEFAULT false
    `);

    // ── solver_run_assignments ───────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE maywin_db.solver_run_assignments
        ADD COLUMN IF NOT EXISTS emergency_override boolean NOT NULL DEFAULT false
    `);

    // ── solver_runs ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE maywin_db.solver_runs
        ADD COLUMN IF NOT EXISTS nurse_stats_json jsonb,
        ADD COLUMN IF NOT EXISTS understaffed_json jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // solver_runs
    await queryRunner.query(`
      ALTER TABLE maywin_db.solver_runs
        DROP COLUMN IF EXISTS nurse_stats_json,
        DROP COLUMN IF EXISTS understaffed_json
    `);

    // solver_run_assignments
    await queryRunner.query(`
      ALTER TABLE maywin_db.solver_run_assignments
        DROP COLUMN IF EXISTS emergency_override
    `);

    // schedule_assignments
    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
        DROP COLUMN IF EXISTS emergency_override
    `);

    // constraint_profiles
    await queryRunner.query(`
      ALTER TABLE maywin_db.constraint_profiles
        DROP COLUMN IF EXISTS max_shifts_per_day,
        DROP COLUMN IF EXISTS min_days_off_per_week,
        DROP COLUMN IF EXISTS max_nights_per_week,
        DROP COLUMN IF EXISTS forbid_night_to_morning,
        DROP COLUMN IF EXISTS forbid_morning_to_night_same_day,
        DROP COLUMN IF EXISTS guarantee_full_coverage,
        DROP COLUMN IF EXISTS allow_emergency_overrides,
        DROP COLUMN IF EXISTS allow_second_shift_same_day_in_emergency,
        DROP COLUMN IF EXISTS ignore_availability_in_emergency,
        DROP COLUMN IF EXISTS allow_night_cap_override_in_emergency,
        DROP COLUMN IF EXISTS allow_rest_rule_override_in_emergency,
        DROP COLUMN IF EXISTS goal_minimize_staff_cost,
        DROP COLUMN IF EXISTS goal_maximize_preference_satisfaction,
        DROP COLUMN IF EXISTS goal_balance_workload,
        DROP COLUMN IF EXISTS goal_balance_night_workload,
        DROP COLUMN IF EXISTS goal_reduce_undesirable_shifts,
        DROP COLUMN IF EXISTS goal_priority_json,
        DROP COLUMN IF EXISTS num_search_workers,
        DROP COLUMN IF EXISTS time_limit_sec
    `);

    // workers
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        DROP COLUMN IF EXISTS is_backup_worker,
        DROP COLUMN IF EXISTS max_overtime_shifts,
        DROP COLUMN IF EXISTS regular_shifts_per_period,
        DROP COLUMN IF EXISTS min_shifts_per_period
    `);
  }
}
