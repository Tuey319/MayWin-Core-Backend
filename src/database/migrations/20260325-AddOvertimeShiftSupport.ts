import { MigrationInterface, QueryRunner, TableColumn, TableUnique } from 'typeorm';

export class AddOvertimeShiftSupport1766325000000 implements MigrationInterface {
  name = 'AddOvertimeShiftSupport1766325000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old unique constraint
    const table = await queryRunner.getTable('maywin_db.schedule_assignments');
    if (table) {
      const oldUnique = table.uniques.find((u) => u.name === 'sa_run_uniq');
      if (oldUnique) {
        await queryRunner.dropUniqueConstraint('maywin_db.schedule_assignments', oldUnique);
      }
    }

    // Add shift_order column
    await queryRunner.addColumn(
      'maywin_db.schedule_assignments',
      new TableColumn({
        name: 'shift_order',
        type: 'integer',
        default: 1,
        isNullable: false,
      }),
    );

    // Add is_overtime column
    await queryRunner.addColumn(
      'maywin_db.schedule_assignments',
      new TableColumn({
        name: 'is_overtime',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    // Add new unique constraint with shift_order
    const newUnique = new TableUnique({
      name: 'sa_run_uniq',
      columnNames: ['schedule_run_id', 'worker_id', 'date', 'shift_order'],
    });
    await queryRunner.createUniqueConstraint('maywin_db.schedule_assignments', newUnique);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new constraint
    const table = await queryRunner.getTable('maywin_db.schedule_assignments');
    if (table) {
      const newUnique = table.uniques.find((u) => u.name === 'sa_run_uniq');
      if (newUnique) {
        await queryRunner.dropUniqueConstraint('maywin_db.schedule_assignments', newUnique);
      }
    }

    // Remove new columns
    await queryRunner.dropColumn('maywin_db.schedule_assignments', 'is_overtime');
    await queryRunner.dropColumn('maywin_db.schedule_assignments', 'shift_order');

    // Restore old constraint
    const oldUnique = new TableUnique({
      name: 'sa_run_uniq',
      columnNames: ['schedule_run_id', 'worker_id', 'date'],
    });
    await queryRunner.createUniqueConstraint('maywin_db.schedule_assignments', oldUnique);
  }
}


