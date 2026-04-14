import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplaySettings20260413000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "maywin_db"."display_settings" (
        "id"         BIGSERIAL PRIMARY KEY,
        "user_id"    BIGINT NOT NULL UNIQUE,
        "settings"   JSONB  NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_display_settings_user"
          FOREIGN KEY ("user_id")
          REFERENCES "maywin_db"."users"("id")
          ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_display_settings_user_id"
        ON "maywin_db"."display_settings" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "maywin_db"."idx_display_settings_user_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "maywin_db"."display_settings";`);
  }
}
