import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaxHoursSettings1757900000000 implements MigrationInterface {
    name = 'AddMaxHoursSettings1757900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add maxHoursPerDay column with default value of 8
        await queryRunner.query(`ALTER TABLE "settings" ADD "maxHoursPerDay" real NOT NULL DEFAULT (8)`);
        
        // Add maxHoursEnabled column with default value of true (1)
        await queryRunner.query(`ALTER TABLE "settings" ADD "maxHoursEnabled" boolean NOT NULL DEFAULT (1)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        await queryRunner.query(`CREATE TABLE "temporary_settings" ("id" integer PRIMARY KEY NOT NULL, "monthlyIncome" real NOT NULL DEFAULT (0), "monthlyCost" real NOT NULL DEFAULT (0), "darkMode" boolean NOT NULL DEFAULT (0), "ignoreWeekends" boolean NOT NULL DEFAULT (1), "updated_at" datetime DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "temporary_settings"("id", "monthlyIncome", "monthlyCost", "darkMode", "ignoreWeekends", "updated_at") SELECT "id", "monthlyIncome", "monthlyCost", "darkMode", "ignoreWeekends", "updated_at" FROM "settings"`);
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`ALTER TABLE "temporary_settings" RENAME TO "settings"`);
    }
}
