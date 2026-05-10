import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds LINE chatbot language preference to workers.
 *
 * workers.line_language — nullable varchar(5).
 *   NULL / 'th' = Thai (default).
 *   'en'        = English.
 *
 * Set when nurse types a language-change command in the LINE chatbot.
 */
export class AddLineLanguage20260511000100 implements MigrationInterface {
  name = 'AddLineLanguage20260511000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        ADD COLUMN IF NOT EXISTS line_language varchar(5) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.workers
        DROP COLUMN IF EXISTS line_language
    `);
  }
}
