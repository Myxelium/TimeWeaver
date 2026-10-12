import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHolidayTypes1757930000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Store as comma-separated string: "public,bank,school,optional,observance"
    // Default to "public,bank" for backwards compatibility
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN holidayTypes TEXT DEFAULT 'public,bank'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly, but for rollback purposes:
    // We would need to recreate the table without the column
  }
}
