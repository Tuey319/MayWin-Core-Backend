import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfiles20260407 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the user_profiles table in the maywin_db schema
        await queryRunner.query(`
            CREATE TABLE "maywin_db"."user_profiles" (
                "id" BIGSERIAL PRIMARY KEY,
                "user_id" BIGINT NOT NULL UNIQUE,
                "avatar_data" TEXT,
                "bio" TEXT,
                "phone_number" TEXT,
                "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "fk_user_profile_user" FOREIGN KEY ("user_id") 
                    REFERENCES "maywin_db"."users"("id") ON DELETE CASCADE
            );
        `);

        // Add index on user_id for faster lookups
        await queryRunner.query(`
            CREATE INDEX "idx_user_profiles_user_id" ON "maywin_db"."user_profiles" ("user_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "maywin_db"."idx_user_profiles_user_id"`);
        await queryRunner.query(`DROP TABLE "maywin_db"."user_profiles"`);
    }
}
