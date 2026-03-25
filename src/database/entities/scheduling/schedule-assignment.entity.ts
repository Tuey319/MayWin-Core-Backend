// src/database/entities/scheduling/schedule-assignment.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'schedule_assignments' })
@Unique('sa_run_uniq', ['schedule_run_id', 'worker_id', 'date', 'shift_order'])
export class ScheduleAssignment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  schedule_id: string;

  @Column({ type: 'bigint' })
  schedule_run_id: string;

  @Column({ type: 'bigint' })
  worker_id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  shift_code: string;

  @Column({ type: 'int', default: 1 })
  shift_order: number;

  @Column({ type: 'boolean', default: false })
  is_overtime: boolean;

  @Column({ type: 'text', default: 'SOLVER' })
  source: string;

  @Column({ type: 'boolean', default: false })
  emergency_override: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
