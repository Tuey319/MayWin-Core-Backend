// src/database/entities/orchestration/solver-run.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SolverPlan } from '../../enums/solver-plan.enum';


export enum SolverRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}


@Entity({ schema: 'maywin_db', name: 'solver_runs' })
export class SolverRun {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'uuid', nullable: true })
  job_id: string | null;

  @Column({ type: 'bigint', nullable: true })
  schedule_id: string | null;

  @Column({ type: 'enum', enum: SolverPlan })
  plan: SolverPlan;

  @Column({ type: 'enum', enum: SolverRunStatus, default: SolverRunStatus.QUEUED })
  status: SolverRunStatus;

  @Column({ type: 'bigint' })
  requested_by: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', default: 1 })
  attempt: number;

  @Column({ type: 'uuid', nullable: true })
  input_artifact_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  output_artifact_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  evaluation_artifact_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  kpis_json: Record<string, any> | null;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  objective_value: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;
}
