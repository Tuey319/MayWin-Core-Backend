import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds Gemini AI consent tracking columns to the workers table.
 * gemini_consent_given is NOT NULL DEFAULT false — always has a value.
 * The two timestamp columns are nullable — null means the event has not occurred.
 * Only one of given_at / declined_at should be set at a time; enforcement is
 * left to the application layer so the schema stays flexible.
 */
export class AddWorkerGeminiConsent20260507000000 implements MigrationInterface {
  name = 'AddWorkerGeminiConsent20260507000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        ADD COLUMN IF NOT EXISTS gemini_consent_given      boolean    NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS gemini_consent_given_at   timestamptz,
        ADD COLUMN IF NOT EXISTS gemini_consent_declined_at timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        DROP COLUMN IF EXISTS gemini_consent_given,
        DROP COLUMN IF EXISTS gemini_consent_given_at,
        DROP COLUMN IF EXISTS gemini_consent_declined_at
    `);
  }
}
