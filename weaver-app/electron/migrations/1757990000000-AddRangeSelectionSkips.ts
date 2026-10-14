import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRangeSelectionSkips1757990000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN skipWeekendsOnSelect boolean NOT NULL DEFAULT (0)`);
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN skipHolidaysOnSelect boolean NOT NULL DEFAULT (0)`);
  }

  public async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly.
  }
}
