import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPopupSettings1757940000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN launchAtLogin boolean NOT NULL DEFAULT (0)`);
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN popupRules TEXT DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly.
  }
}
