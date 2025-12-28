// src/database/entities/workers/worker.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  TEMP = 'TEMP',
}

@Entity({ schema: 'maywin_db', name: 'workers' })
@Unique('workers_org_code_uniq', ['organization_id', 'worker_code'])
export class Worker {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  organization_id: string;

  @Column({ type: 'bigint', nullable: true })
  primary_unit_id: string | null;

  @Column({ type: 'text' })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  worker_code: string | null;

  @Column({ type: 'enum', enum: EmploymentType, nullable: true })
  employment_type: EmploymentType | null;

  @Column({ type: 'int', nullable: true })
  weekly_hours: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'bigint', nullable: true })
  linked_user_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
