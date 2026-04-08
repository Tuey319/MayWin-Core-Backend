// src/database/entities/users/user-profile.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, JoinColumn, OneToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity({ schema: 'maywin_db', name: 'user_profiles' })
export class UserProfile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  avatar_data: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  phone_number: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
