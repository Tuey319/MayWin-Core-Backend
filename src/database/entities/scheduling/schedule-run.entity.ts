import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'schedule_runs' })
export class ScheduleRun {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  schedule_id: string;

  @Column({ type: 'uuid', nullable: true })
  job_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
