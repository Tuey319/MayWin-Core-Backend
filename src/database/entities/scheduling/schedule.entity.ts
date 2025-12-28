// src/database/entities/scheduling/schedule.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ScheduleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity({ schema: 'maywin_db', name: 'schedules' })
export class Schedule {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  organization_id: string;

  @Column({ type: 'bigint' })
  unit_id: string;

  @Column({ type: 'uuid', nullable: true })
  job_id: string | null;

  @Column({ type: 'text', default: 'Generated Schedule' })
  name: string;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'enum', enum: ScheduleStatus, default: ScheduleStatus.DRAFT })
  status: ScheduleStatus;

  @Column({ type: 'bigint', nullable: true })
  constraint_profile_id: string | null;

  @Column({ type: 'bigint', nullable: true })
  last_solver_run_id: string | null;

  @Column({ type: 'bigint' })
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ type: 'bigint', nullable: true })
  published_by: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;
}
