import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdoSyncEnabled1757970000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoSyncEnabled boolean NOT NULL DEFAULT (0)`);
  }

  public async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly.
  }
}
