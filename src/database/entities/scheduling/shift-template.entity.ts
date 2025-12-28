// src/database/entities/scheduling/shift-template.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'shift_templates' })
@Unique('st_uniq', ['organization_id', 'unit_id', 'code'])
export class ShiftTemplate {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  organization_id: string;

  @Column({ type: 'bigint', nullable: true })
  unit_id: string | null;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
