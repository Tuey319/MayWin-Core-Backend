import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix cascade deletes across the org → unit → worker hierarchy.
 *
 * Many FK constraints had no ON DELETE action, causing FK violations when
 * deleting an org (which cascades to units, which then fail because child
 * tables still reference those units with no cascade).
 *
 * Constraint names are discovered dynamically via pg_constraint because the
 * live DB may have been created with explicit names differing from Postgres
 * defaults, and previous migration attempts may have left duplicate constraints.
 */
export class AddOrgCascadeDeletes1774200000000 implements MigrationInterface {
  name = 'AddOrgCascadeDeletes1774200000000';

  // ── What needs fixing ──────────────────────────────────────────────────────
  // format: { child table, child column, referenced table, action }

  private readonly TARGETS: Array<{
    table: string;
    column: string;
    references: string;
    action: 'CASCADE' | 'SET NULL';
  }> = [
    // org-level cascades
    { table: 'sites',                 column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'units',                 column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'users',                 column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'workers',               column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'worker_messages',       column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'shift_templates',       column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'schedules',             column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'schedule_jobs',         column: 'organization_id', references: 'organizations', action: 'CASCADE'  },
    { table: 'chatbot_conversations', column: 'organization_id', references: 'organizations', action: 'SET NULL' },
    { table: 'constraint_profiles',   column: 'org_id',          references: 'organizations', action: 'SET NULL' },

    // site-level cascades
    { table: 'units',                 column: 'site_id',         references: 'sites',         action: 'SET NULL' },

    // unit-level cascades (the missing link causing the current error)
    { table: 'worker_availability',   column: 'unit_id',         references: 'units',         action: 'CASCADE'  },
    { table: 'workers',               column: 'primary_unit_id', references: 'units',         action: 'SET NULL' },
    { table: 'worker_messages',       column: 'unit_id',         references: 'units',         action: 'SET NULL' },
    { table: 'chatbot_conversations', column: 'unit_id',         references: 'units',         action: 'SET NULL' },
    { table: 'shift_templates',       column: 'unit_id',         references: 'units',         action: 'SET NULL' },
    { table: 'schedules',             column: 'unit_id',         references: 'units',         action: 'SET NULL' },

    // worker-level cascades
    { table: 'worker_messages',       column: 'worker_id',        references: 'workers', action: 'CASCADE'  },
    { table: 'worker_messages',       column: 'sender_worker_id', references: 'workers', action: 'SET NULL' },
    { table: 'schedule_assignments',  column: 'worker_id',        references: 'workers', action: 'CASCADE'  },
    { table: 'workers',               column: 'linked_user_id',   references: 'users',   action: 'SET NULL' },
    { table: 'worker_messages',       column: 'sender_user_id',   references: 'users',   action: 'SET NULL' },
  ];

  /** Find ALL FK constraint names for a given child table+column+referenced table. */
  private async findFkNames(
    qr: QueryRunner,
    table: string,
    column: string,
    references: string,
  ): Promise<string[]> {
    const rows: { conname: string }[] = await qr.query(`
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class     rel ON rel.oid = c.conrelid
      JOIN pg_namespace ns  ON ns.oid  = rel.relnamespace
      JOIN pg_class     ref ON ref.oid = c.confrelid
      JOIN pg_attribute att ON att.attrelid = c.conrelid
                            AND att.attnum   = ANY(c.conkey)
      WHERE c.contype    = 'f'
        AND ns.nspname   = 'maywin_db'
        AND rel.relname  = $1
        AND att.attname  = $2
        AND ref.relname  = $3
    `, [table, column, references]);
    return rows.map((r) => r.conname);
  }

  private async retargetFk(
    qr: QueryRunner,
    table: string,
    column: string,
    references: string,
    action: 'CASCADE' | 'SET NULL',
  ) {
    const fullTable = `maywin_db.${table}`;
    const existing = await this.findFkNames(qr, table, column, references);

    // Drop all existing FKs (handles any duplicates from prior migration attempts)
    for (const name of existing) {
      await qr.query(`ALTER TABLE ${fullTable} DROP CONSTRAINT "${name}"`);
    }

    const newName = `${table}_${column}_${references}_fkey`;
    await qr.query(`
      ALTER TABLE ${fullTable}
        ADD CONSTRAINT ${newName}
          FOREIGN KEY (${column})
          REFERENCES maywin_db.${references}(id)
          ON DELETE ${action}
    `);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clean up orphaned rows that would block FK creation.
    // These exist because the original schema had no FK enforcement on these columns.
    await queryRunner.query(`
      DELETE FROM maywin_db.worker_messages
      WHERE worker_id NOT IN (SELECT id FROM maywin_db.workers)
    `);
    await queryRunner.query(`
      DELETE FROM maywin_db.worker_availability
      WHERE worker_id NOT IN (SELECT id FROM maywin_db.workers)
         OR unit_id   NOT IN (SELECT id FROM maywin_db.units)
    `);
    await queryRunner.query(`
      DELETE FROM maywin_db.schedule_assignments
      WHERE worker_id NOT IN (SELECT id FROM maywin_db.workers)
    `);

    for (const { table, column, references, action } of this.TARGETS) {
      await this.retargetFk(queryRunner, table, column, references, action);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column, references } of this.TARGETS) {
      const fullTable = `maywin_db.${table}`;
      const existing = await this.findFkNames(queryRunner, table, column, references);
      for (const name of existing) {
        await queryRunner.query(`ALTER TABLE ${fullTable} DROP CONSTRAINT "${name}"`);
      }
      // Restore plain FK with no action
      await queryRunner.query(`
        ALTER TABLE ${fullTable}
          ADD CONSTRAINT ${table}_${column}_fkey
            FOREIGN KEY (${column})
            REFERENCES maywin_db.${references}(id)
      `);
    }
  }
}
