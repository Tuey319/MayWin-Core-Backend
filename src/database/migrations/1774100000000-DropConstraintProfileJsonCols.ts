import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropConstraintProfileJsonCols1774100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.constraint_profiles
        DROP COLUMN IF EXISTS constraints_json,
        DROP COLUMN IF EXISTS goals_json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.constraint_profiles
        ADD COLUMN IF NOT EXISTS constraints_json jsonb,
        ADD COLUMN IF NOT EXISTS goals_json jsonb
    `);
  }
}
