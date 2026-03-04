import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatbotConversations1739894400000 implements MigrationInterface {
  name = 'AddChatbotConversations1739894400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'conversation_state' AND n.nspname = 'maywin_db'
  ) THEN
    CREATE TYPE maywin_db.conversation_state AS ENUM ('IDLE','AWAITING_CONFIRMATION','PROCESSING');
  END IF;
END
$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS maywin_db.chatbot_conversations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        line_user_id text NOT NULL UNIQUE,
        worker_id bigint,
        organization_id bigint,
        unit_id bigint,
        state maywin_db.conversation_state NOT NULL DEFAULT 'IDLE',
        pending_data jsonb,
        attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_chatbot_conversations_line_user_id
      ON maywin_db.chatbot_conversations (line_user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_chatbot_conversations_worker_id
      ON maywin_db.chatbot_conversations (worker_id)
      WHERE worker_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS maywin_db.chatbot_conversations`);
    await queryRunner.query(`DROP TYPE IF EXISTS maywin_db.conversation_state`);
  }
}
