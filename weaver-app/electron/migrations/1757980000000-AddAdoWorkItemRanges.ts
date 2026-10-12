import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdoWorkItemRanges1757980000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ado_work_items ADD COLUMN ranges text`);
  }

  public async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly.
  }
}
