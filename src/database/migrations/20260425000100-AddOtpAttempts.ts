import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds an attempts counter to auth_otps so the verification flow can
 * invalidate OTPs after 5 consecutive incorrect submissions, preventing
 * brute-force of the 6-digit code space.
 */
export class AddOtpAttempts20260425000100 implements MigrationInterface {
  name = 'AddOtpAttempts20260425000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.auth_otps
        ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.auth_otps
        DROP COLUMN IF EXISTS attempts
    `);
  }
}
