import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdoAuthMethod1757960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoAuthMethod TEXT DEFAULT 'pat'`);
  }

  public async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly.
  }
}
