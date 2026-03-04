// src/database/entities/workers/chatbot-conversation.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ConversationState {
  IDLE = 'IDLE',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  PROCESSING = 'PROCESSING',
}

@Entity({ schema: 'maywin_db', name: 'chatbot_conversations' })
@Index('ix_chatbot_conversations_line_user_id', ['line_user_id'])
@Index('ix_chatbot_conversations_worker_id', ['worker_id'])
export class ChatbotConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  line_user_id!: string;

  @Column({ type: 'bigint', nullable: true })
  worker_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  organization_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  unit_id!: string | null;

  @Column({
    type: 'enum',
    enum: ConversationState,
    default: ConversationState.IDLE,
  })
  state!: ConversationState;

  @Column({ type: 'jsonb', nullable: true })
  pending_data!: any | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  attributes!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
