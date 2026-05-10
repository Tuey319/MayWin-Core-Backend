import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds LINE chatbot terms-acceptance tracking.
 *
 * workers.line_terms_accepted_at — nullable timestamptz.
 *   NULL  = has never accepted (default for all existing rows).
 *   value = the moment they typed "ยอมรับ" in the LINE chatbot.
 *
 * chatbot_conversations.state enum — adds AWAITING_TERMS so the
 *   service can gate the consent flow without hitting Gemini.
 */
export class AddLineTermsAccepted20260511000000 implements MigrationInterface {
  name = 'AddLineTermsAccepted20260511000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the new column to workers (default NULL = not accepted yet)
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        ADD COLUMN IF NOT EXISTS line_terms_accepted_at timestamptz DEFAULT NULL
    `);

    // 2. Add AWAITING_TERMS to the existing enum using a safe OID-based lookup
    //    (avoids ::regtype cast issues with schema-qualified enum type names)
    await queryRunner.query(`
      DO $$
      DECLARE
        v_typid oid;
      BEGIN
        SELECT t.oid INTO v_typid
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'chatbot_conversations_state_enum'
          AND n.nspname = 'maywin_db';

        IF v_typid IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = v_typid AND enumlabel = 'AWAITING_TERMS'
        ) THEN
          ALTER TYPE maywin_db.chatbot_conversations_state_enum ADD VALUE 'AWAITING_TERMS';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the column (enum value removal is intentionally omitted —
    // PostgreSQL does not support dropping individual enum values cleanly).
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        DROP COLUMN IF EXISTS line_terms_accepted_at
    `);
  }
}
