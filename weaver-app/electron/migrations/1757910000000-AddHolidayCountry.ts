import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHolidayCountry1757910000000 implements MigrationInterface {
    name = 'AddHolidayCountry1757910000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add holidayCountry column as text nullable
        await queryRunner.query(`ALTER TABLE "settings" ADD "holidayCountry" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQLite doesn't support DROP COLUMN directly; recreate table without column
        await queryRunner.query(`CREATE TABLE "temporary_settings" ("id" integer PRIMARY KEY NOT NULL, "monthlyIncome" real NOT NULL DEFAULT (0), "monthlyCost" real NOT NULL DEFAULT (0), "darkMode" boolean NOT NULL DEFAULT (0), "ignoreWeekends" boolean NOT NULL DEFAULT (1), "maxHoursPerDay" real NOT NULL DEFAULT (8), "maxHoursEnabled" boolean NOT NULL DEFAULT (1), "updated_at" datetime DEFAULT (datetime('now'))) `);
        await queryRunner.query(`INSERT INTO "temporary_settings" ("id", "monthlyIncome", "monthlyCost", "darkMode", "ignoreWeekends", "maxHoursPerDay", "maxHoursEnabled", "updated_at") SELECT "id", "monthlyIncome", "monthlyCost", "darkMode", "ignoreWeekends", "maxHoursPerDay", "maxHoursEnabled", "updated_at" FROM "settings"`);
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`ALTER TABLE "temporary_settings" RENAME TO "settings"`);
    }
}
