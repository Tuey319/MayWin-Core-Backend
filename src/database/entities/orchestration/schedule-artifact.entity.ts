// src/database/entities/orchestration/schedule-artifact.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ScheduleArtifactType {
  NORMALIZED_INPUT = 'NORMALIZED_INPUT',
  SOLVER_OUTPUT = 'SOLVER_OUTPUT',
  EVALUATION_REPORT = 'EVALUATION_REPORT',
  FINAL_SCHEDULE_EXPORT = 'FINAL_SCHEDULE_EXPORT',
  KPI_SUMMARY = 'KPI_SUMMARY',
}

@Entity({ schema: 'maywin_db', name: 'schedule_artifacts' })
export class ScheduleArtifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  job_id: string;

  @Column({ type: 'enum', enum: ScheduleArtifactType })
  type: ScheduleArtifactType;

  @Column({ type: 'text', default: 's3' })
  storage_provider: string;

  @Column({ type: 'text', nullable: true })
  bucket: string | null;

  @Column({ type: 'text', nullable: true })
  object_key: string | null;

  @Column({ type: 'text', nullable: true })
  content_type: string | null;

  @Column({ type: 'text', nullable: true })
  content_sha256: string | null;

  @Column({ type: 'bigint', nullable: true })
  content_bytes: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
