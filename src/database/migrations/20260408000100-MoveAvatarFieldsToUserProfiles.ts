import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Move avatar storage metadata from users to user_profiles.
 *
 * Keeps the user account table focused on authentication/identity while
 * letting profile rows own avatar location and content metadata.
 */
export class MoveAvatarFieldsToUserProfiles20260408000100 implements MigrationInterface {
  name = 'MoveAvatarFieldsToUserProfiles20260408000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.user_profiles
        ADD COLUMN IF NOT EXISTS avatar_bucket text,
        ADD COLUMN IF NOT EXISTS avatar_key text,
        ADD COLUMN IF NOT EXISTS avatar_content_type text,
        ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.users
        DROP COLUMN IF EXISTS avatar_updated_at,
        DROP COLUMN IF EXISTS avatar_content_type,
        DROP COLUMN IF EXISTS avatar_key,
        DROP COLUMN IF EXISTS avatar_bucket
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.users
        ADD COLUMN IF NOT EXISTS avatar_bucket text,
        ADD COLUMN IF NOT EXISTS avatar_key text,
        ADD COLUMN IF NOT EXISTS avatar_content_type text,
        ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.user_profiles
        DROP COLUMN IF EXISTS avatar_updated_at,
        DROP COLUMN IF EXISTS avatar_content_type,
        DROP COLUMN IF EXISTS avatar_key,
        DROP COLUMN IF EXISTS avatar_bucket
    `);
  }
}
