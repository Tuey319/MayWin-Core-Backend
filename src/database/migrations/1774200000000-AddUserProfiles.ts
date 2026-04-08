import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfiles1774200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the user_profiles table in the maywin_db schema
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "maywin_db"."user_profiles" (
                "id" BIGSERIAL PRIMARY KEY,
                "user_id" BIGINT NOT NULL UNIQUE,
                "avatar_data" TEXT,
                "avatar_bucket" TEXT,
                "avatar_key" TEXT,
                "avatar_content_type" TEXT,
                "avatar_updated_at" TIMESTAMPTZ,
                "bio" TEXT,
                "phone_number" TEXT,
                "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "fk_user_profile_user" FOREIGN KEY ("user_id") 
                    REFERENCES "maywin_db"."users"("id") ON DELETE CASCADE
            );
        `);

        await queryRunner.query(`
            ALTER TABLE "maywin_db"."user_profiles"
                ADD COLUMN IF NOT EXISTS "avatar_data" TEXT,
                ADD COLUMN IF NOT EXISTS "avatar_bucket" TEXT,
                ADD COLUMN IF NOT EXISTS "avatar_key" TEXT,
                ADD COLUMN IF NOT EXISTS "avatar_content_type" TEXT,
                ADD COLUMN IF NOT EXISTS "avatar_updated_at" TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS "bio" TEXT,
                ADD COLUMN IF NOT EXISTS "phone_number" TEXT,
                ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
        `);

        // Add index on user_id for faster lookups
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_user_profiles_user_id" ON "maywin_db"."user_profiles" ("user_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "maywin_db"."idx_user_profiles_user_id"`);
        await queryRunner.query(`DROP TABLE "maywin_db"."user_profiles"`);
    }
}
