// src/database/entities/users/auth-otp.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'auth_otps' })
@Index('ix_auth_otps_user_id', ['user_id'])
export class AuthOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  /** Raw 6-digit code (short-lived, low value — not worth bcrypt overhead) */
  @Column({ type: 'text' })
  otp_code: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  used_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
