// src/database/entities/orchestration/schedule-job.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SolverPlan } from '../../enums/solver-plan.enum';

export enum ScheduleJobStatus {
  REQUESTED = 'REQUESTED',
  VALIDATED = 'VALIDATED',
  NORMALIZING = 'NORMALIZING',
  SOLVING_A_STRICT = 'SOLVING_A_STRICT',
  SOLVING_A_RELAXED = 'SOLVING_A_RELAXED',
  SOLVING_B_MILP = 'SOLVING_B_MILP',
  EVALUATING = 'EVALUATING',
  PERSISTING = 'PERSISTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity({ schema: 'maywin_db', name: 'schedule_jobs' })
export class ScheduleJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  organization_id: string;

  @Column({ type: 'bigint' })
  unit_id: string;

  @Column({ type: 'bigint' })
  requested_by: string;

  @Column({ type: 'text', nullable: true })
  idempotency_key: string | null;

  @Column({ type: 'enum', enum: ScheduleJobStatus, default: ScheduleJobStatus.REQUESTED })
  status: ScheduleJobStatus;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'enum', enum: SolverPlan, nullable: true })
  chosen_plan: SolverPlan | null;

  @Column({ type: 'bigint', nullable: true })
  final_schedule_id: string | null;

  @Column({ type: 'text', nullable: true })
  error_code: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
