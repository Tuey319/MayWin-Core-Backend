import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * OTP codes were previously stored as plaintext 6-digit strings.
 * They are now stored as SHA-256 hex digests (64 chars).
 *
 * The column type (text) already accommodates 64-char hex strings —
 * no DDL change is required.
 *
 * All existing rows are deleted because:
 *   1. Any plaintext value would fail the new hash comparison and be
 *      permanently unusable, so keeping them is misleading.
 *   2. OTPs are short-lived (10 min TTL) — in-flight codes will simply
 *      require the user to request a new one after deployment.
 *   3. Rows marked used_at IS NOT NULL are already spent — no functional loss.
 */
export class HashExistingOtpCodes20260425000000 implements MigrationInterface {
  name = 'HashExistingOtpCodes20260425000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM maywin_db.auth_otps`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Plaintext codes cannot be recovered — down() is intentionally a no-op.
    // Rollback the application code instead of rolling back this migration.
  }
}
