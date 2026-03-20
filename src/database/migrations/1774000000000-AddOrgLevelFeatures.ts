import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Org-level features
 *
 * - schedules: makes unit_id nullable (org-level containers need no unit), adds notes column
 * - constraint_profiles: makes unit_id nullable, adds org_id + UI display columns
 *   (description, assigned_to, color, constraints_json, goals_json)
 */
export class AddOrgLevelFeatures1774000000000 implements MigrationInterface {
  name = 'AddOrgLevelFeatures1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── schedules ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE maywin_db.schedules
        ALTER COLUMN unit_id DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS notes text
    `);

    // ── constraint_profiles ───────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE maywin_db.constraint_profiles
        ALTER COLUMN unit_id DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS org_id bigint,
        ADD COLUMN IF NOT EXISTS description text,
        ADD COLUMN IF NOT EXISTS assigned_to text,
        ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'primary',
        ADD COLUMN IF NOT EXISTS constraints_json jsonb,
        ADD COLUMN IF NOT EXISTS goals_json jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // constraint_profiles
    await queryRunner.query(`
      ALTER TABLE maywin_db.constraint_profiles
        DROP COLUMN IF EXISTS goals_json,
        DROP COLUMN IF EXISTS constraints_json,
        DROP COLUMN IF EXISTS color,
        DROP COLUMN IF EXISTS assigned_to,
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS org_id
    `);
    // NOTE: we cannot safely re-add NOT NULL to unit_id if nulls exist

    // schedules
    await queryRunner.query(`
      ALTER TABLE maywin_db.schedules
        DROP COLUMN IF EXISTS notes
    `);
  }
}
