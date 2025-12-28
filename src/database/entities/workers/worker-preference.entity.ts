// src/database/entities/workers/worker-preference.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'worker_preferences' })
export class WorkerPreference {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', unique: true })
  worker_id: string;

  @Column({ type: 'boolean', nullable: true })
  prefers_day_shifts: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  prefers_night_shifts: boolean | null;

  @Column({ type: 'int', nullable: true })
  max_consecutive_work_days: number | null;

  @Column({ type: 'int', nullable: true })
  max_consecutive_night_shifts: number | null;

  @Column({ type: 'jsonb', nullable: true })
  preference_pattern_json: Record<string, any> | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
