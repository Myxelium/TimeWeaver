import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOvertimeRate1757920000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN overtimeRate REAL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly, but for rollback purposes:
    // We would need to recreate the table without the column
  }
}
