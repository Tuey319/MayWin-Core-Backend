import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDayOffToAvailabilityTypeEnum1772190770101 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_type') THEN
                    CREATE TYPE "maywin_db"."availability_type" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'PREFERRED', 'AVOID', 'DAY_OFF');
                ELSE
                    -- Add DAY_OFF to existing enum
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DAY_OFF' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'availability_type')) THEN
                        ALTER TYPE "maywin_db"."availability_type" ADD VALUE 'DAY_OFF';
                    END IF;
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Enum value removal is not supported in PostgreSQL, so this is a no-op
    }
}
