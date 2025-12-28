// src/database/entities/scheduling/constraint-profile.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'constraint_profiles' })
export class ConstraintProfile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  unit_id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'int', nullable: true })
  max_consecutive_work_days: number | null;

  @Column({ type: 'int', nullable: true })
  max_consecutive_night_shifts: number | null;

  @Column({ type: 'int', nullable: true })
  min_rest_hours_between_shifts: number | null;

  @Column({ type: 'jsonb', nullable: true })
  fairness_weight_json: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  penalty_weight_json: Record<string, any> | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
