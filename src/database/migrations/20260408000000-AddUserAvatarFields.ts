import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: add avatar storage metadata to users
 *
 * Stores the S3 bucket/key and content type for profile pictures.
 */
export class AddUserAvatarFields20260408000000 implements MigrationInterface {
  name = 'AddUserAvatarFields20260408000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.users
        ADD COLUMN IF NOT EXISTS avatar_bucket text,
        ADD COLUMN IF NOT EXISTS avatar_key text,
        ADD COLUMN IF NOT EXISTS avatar_content_type text,
        ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.users
        DROP COLUMN IF EXISTS avatar_updated_at,
        DROP COLUMN IF EXISTS avatar_content_type,
        DROP COLUMN IF EXISTS avatar_key,
        DROP COLUMN IF EXISTS avatar_bucket
    `);
  }
}
