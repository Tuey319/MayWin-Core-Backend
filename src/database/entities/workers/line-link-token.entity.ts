// src/database/entities/workers/line-link-token.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'line_link_tokens' })
@Index('ix_line_link_tokens_worker_id', ['worker_id'])
export class LineLinkToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  worker_id: string;

  /** Short uppercase alphanumeric code, e.g. "A3X9K2" */
  @Column({ type: 'text', unique: true })
  token: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  /** Set when the nurse uses this token to link their LINE account */
  @Column({ type: 'timestamptz', nullable: true })
  used_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
