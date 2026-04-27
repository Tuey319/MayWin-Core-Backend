import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds expires_at to chatbot_conversations to enforce PDPA §26 data-minimisation.
 * Existing rows get NOW() + 90 days so they are not immediately swept.
 * New rows receive the default automatically; ChatbotCleanupService deletes
 * expired rows nightly at 02:00 (DATA-001).
 */
export class AddChatbotConversationExpiresAt20260425000200 implements MigrationInterface {
  name = 'AddChatbotConversationExpiresAt20260425000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.chatbot_conversations
        ADD COLUMN IF NOT EXISTS expires_at timestamptz
          NOT NULL DEFAULT NOW() + INTERVAL '90 days'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.chatbot_conversations
        DROP COLUMN IF EXISTS expires_at
    `);
  }
}
