import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdoSuggestions1757950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoOrganization TEXT`);
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoPat TEXT`);
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoLastSyncOn TEXT`);
    await queryRunner.query(`ALTER TABLE settings ADD COLUMN adoLastSyncError TEXT`);
    await queryRunner.query(`ALTER TABLE tasks ADD COLUMN adoWorkItemId integer`);
    await queryRunner.query(`CREATE TABLE "ado_work_items" ("adoId" integer PRIMARY KEY NOT NULL, "title" text NOT NULL, "activeOn" text, "rangeEnd" text)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ado_work_items"`);
  }
}
