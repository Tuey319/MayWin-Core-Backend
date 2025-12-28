// src/database/entities/workers/worker-unit.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'worker_unit_memberships' })
export class WorkerUnitMembership {
  @PrimaryColumn({ type: 'bigint' })
  worker_id: string;

  @PrimaryColumn({ type: 'bigint' })
  unit_id: string;

  @Column({ type: 'text', nullable: true })
  role_code: string | null;
}
