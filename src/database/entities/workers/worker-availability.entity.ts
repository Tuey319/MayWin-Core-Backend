// src/database/entities/workers/worker-availability.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum AvailabilityType {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  PREFERRED = 'PREFERRED',
  AVOID = 'AVOID',
}

@Entity({ schema: 'maywin_db', name: 'worker_availability' })
@Unique('wa_uniq', ['worker_id', 'unit_id', 'date', 'shift_code'])
export class WorkerAvailability {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  worker_id: string;

  @Column({ type: 'bigint' })
  unit_id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  shift_code: string;

  @Column({ type: 'enum', enum: AvailabilityType })
  type: AvailabilityType;

  @Column({ type: 'text' })
  source: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
