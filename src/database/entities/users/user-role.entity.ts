// src/database/entities/users/user-role.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'user_roles' })
export class UserRole {
  @PrimaryColumn({ type: 'bigint' })
  user_id: string;

  @PrimaryColumn({ type: 'bigint' })
  role_id: string;
}
