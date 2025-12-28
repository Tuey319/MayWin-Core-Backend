// src/database/entities/scheduling/schedule-assignment.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'schedule_assignments' })
@Unique('sa_uniq', ['schedule_id', 'worker_id', 'date'])
export class ScheduleAssignment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  schedule_id: string;

  @Column({ type: 'bigint' })
  worker_id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  shift_code: string;

  @Column({ type: 'text', default: 'SOLVER' })
  source: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
