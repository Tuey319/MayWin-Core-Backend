// src/database/entities/scheduling/coverage-rule.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'coverage_rules' })
export class CoverageRule {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  unit_id: string;

  @Column({ type: 'text' })
  shift_code: string;

  @Column({ type: 'text' })
  day_type: string;

  @Column({ type: 'int', nullable: true })
  min_workers: number | null;

  @Column({ type: 'int', nullable: true })
  max_workers: number | null;

  @Column({ type: 'text', nullable: true })
  required_tag: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
