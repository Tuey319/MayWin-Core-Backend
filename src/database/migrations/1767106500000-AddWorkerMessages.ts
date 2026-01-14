import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkerMessages1767106500000 implements MigrationInterface {
  name = 'AddWorkerMessages1767106500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'message_direction' AND n.nspname = 'maywin_db'
  ) THEN
    CREATE TYPE maywin_db.message_direction AS ENUM ('INBOUND','OUTBOUND');
  END IF;
END
$$;
    `);

    await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'message_status' AND n.nspname = 'maywin_db'
  ) THEN
    CREATE TYPE maywin_db.message_status AS ENUM ('SENT','DELIVERED','READ','ARCHIVED');
  END IF;
END
$$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS maywin_db.worker_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id bigint NOT NULL,
        unit_id bigint,
        worker_id bigint NOT NULL,
        sender_user_id bigint,
        sender_worker_id bigint,
        direction maywin_db.message_direction NOT NULL,
        status maywin_db.message_status NOT NULL,
        subject text,
        body text NOT NULL,
        job_id uuid,
        schedule_id bigint,
        shift_date date,
        shift_code text,
        attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT worker_messages_sender_chk
          CHECK (sender_user_id IS NOT NULL OR sender_worker_id IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_worker_messages_worker_time
      ON maywin_db.worker_messages (worker_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_worker_messages_unit_time
      ON maywin_db.worker_messages (unit_id, created_at DESC)
      WHERE unit_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_worker_messages_job_time
      ON maywin_db.worker_messages (job_id, created_at DESC)
      WHERE job_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS maywin_db.worker_messages`);
    await queryRunner.query(`DROP TYPE IF EXISTS maywin_db.message_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS maywin_db.message_direction`);
  }
}
