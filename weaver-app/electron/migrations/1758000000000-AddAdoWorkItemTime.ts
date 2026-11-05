import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdoWorkItemTime1758000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ado_work_items ADD COLUMN workItemType text`);
    await queryRunner.query(`ALTER TABLE ado_work_items ADD COLUMN state text`);
    await queryRunner.query(`ALTER TABLE ado_work_items ADD COLUMN completedWork real`);
    await queryRunner.query(`ALTER TABLE ado_work_items ADD COLUMN changedOn text`);
  }

  public async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly.
  }
}
