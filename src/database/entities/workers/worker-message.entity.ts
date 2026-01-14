// src/database/entities/workers/worker-message.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'ARCHIVED';

@Entity({ schema: 'maywin_db', name: 'worker_messages' })
@Index('ix_worker_messages_worker_time', ['worker_id', 'created_at'])
@Index('ix_worker_messages_unit_time', ['unit_id', 'created_at'])
@Index('ix_worker_messages_job_time', ['job_id', 'created_at'])
export class WorkerMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint' })
  organization_id!: string;

  @Column({ type: 'bigint', nullable: true })
  unit_id!: string | null;

  @Column({ type: 'bigint' })
  worker_id!: string;

  @Column({ type: 'bigint', nullable: true })
  sender_user_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  sender_worker_id!: string | null;

    @Column({
    type: 'enum',   
    enum: ['INBOUND', 'OUTBOUND'],
    enumName: 'message_direction',
    })
    direction!: MessageDirection;

    @Column({
    type: 'enum',
    enum: ['SENT', 'DELIVERED', 'READ', 'ARCHIVED'],
    enumName: 'message_status',
    })
    status!: MessageStatus;

  @Column({ type: 'text', nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'uuid', nullable: true })
  job_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  schedule_id!: string | null;

  @Column({ type: 'date', nullable: true })
  shift_date!: string | null; // yyyy-mm-dd

  @Column({ type: 'text', nullable: true })
  shift_code!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  attributes!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
