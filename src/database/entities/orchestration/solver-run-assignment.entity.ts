// src/database/entities/orchestration/solver-run-assignment.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'solver_run_assignments' })
@Unique('sra_uniq', ['solver_run_id', 'worker_id', 'date'])
export class SolverRunAssignment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  solver_run_id: string;

  @Column({ type: 'bigint' })
  worker_id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  shift_code: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;
}
