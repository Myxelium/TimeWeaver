import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdoTimeSettings1758010000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoTimeSpentField text NOT NULL DEFAULT ('Time spent')`);
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoHideNeedsTime boolean NOT NULL DEFAULT (0)`);
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoIgnoreHigherAzureTime boolean NOT NULL DEFAULT (0)`);
  }

  public async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly.
  }
}
