// src/database/entities/core/site.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'sites' })
@Unique('sites_org_code_uniq', ['organization_id', 'code'])
export class Site {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  organization_id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  timezone: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
