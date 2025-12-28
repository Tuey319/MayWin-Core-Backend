// src/database/entities/users/unit-membership.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'unit_memberships' })
@Unique('um_unit_user_uniq', ['unit_id', 'user_id'])
export class UnitMembership {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  unit_id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column({ type: 'text' })
  role_code: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
