import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleRuns1767210000000 implements MigrationInterface {
  name = 'AddScheduleRuns1767210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS maywin_db.schedule_runs (
        id bigserial PRIMARY KEY,
        schedule_id bigint NOT NULL,
        job_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      ADD COLUMN IF NOT EXISTS schedule_run_id bigint
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedules
      ADD COLUMN IF NOT EXISTS current_run_id bigint
    `);

    await queryRunner.query(`
      WITH inserted AS (
        INSERT INTO maywin_db.schedule_runs (schedule_id, job_id, created_at)
        SELECT s.id, s.job_id, s.created_at
        FROM maywin_db.schedules s
        WHERE NOT EXISTS (
          SELECT 1 FROM maywin_db.schedule_runs sr WHERE sr.schedule_id = s.id
        )
        RETURNING id, schedule_id
      )
      UPDATE maywin_db.schedule_assignments sa
      SET schedule_run_id = i.id
      FROM inserted i
      WHERE sa.schedule_id = i.schedule_id AND sa.schedule_run_id IS NULL
    `);

    await queryRunner.query(`
      WITH latest AS (
        SELECT sr.schedule_id, max(sr.id) as run_id
        FROM maywin_db.schedule_runs sr
        GROUP BY sr.schedule_id
      )
      UPDATE maywin_db.schedules s
      SET current_run_id = l.run_id
      FROM latest l
      WHERE s.id = l.schedule_id AND s.current_run_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      DROP CONSTRAINT IF EXISTS sa_uniq
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      ADD CONSTRAINT sa_run_uniq UNIQUE (schedule_run_id, worker_id, date)
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      ALTER COLUMN schedule_run_id SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      DROP CONSTRAINT IF EXISTS sa_run_uniq
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      ALTER COLUMN schedule_run_id DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      ADD CONSTRAINT sa_uniq UNIQUE (schedule_id, worker_id, date)
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedule_assignments
      DROP COLUMN IF EXISTS schedule_run_id
    `);

    await queryRunner.query(`
      ALTER TABLE maywin_db.schedules
      DROP COLUMN IF EXISTS current_run_id
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS maywin_db.schedule_runs
    `);
  }
}
