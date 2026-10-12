import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFirstDayOfWeek1757915000000 implements MigrationInterface {
    name = 'AddFirstDayOfWeek1757915000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD "firstDayOfWeek" integer NOT NULL DEFAULT (1)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate table without column for SQLite
        await queryRunner.query(`CREATE TABLE "temporary_settings" ("id" integer PRIMARY KEY NOT NULL, "monthlyIncome" real NOT NULL DEFAULT (0), "monthlyCost" real NOT NULL DEFAULT (0), "darkMode" boolean NOT NULL DEFAULT (0), "ignoreWeekends" boolean NOT NULL DEFAULT (1), "maxHoursPerDay" real NOT NULL DEFAULT (8), "maxHoursEnabled" boolean NOT NULL DEFAULT (1), "holidayCountry" text, "updated_at" datetime DEFAULT (datetime('now'))) `);
        await queryRunner.query(`INSERT INTO "temporary_settings" ("id", "monthlyIncome", "monthlyCost", "darkMode", "ignoreWeekends", "maxHoursPerDay", "maxHoursEnabled", "holidayCountry", "updated_at") SELECT "id", "monthlyIncome", "monthlyCost", "darkMode", "ignoreWeekends", "maxHoursPerDay", "maxHoursEnabled", "holidayCountry", "updated_at" FROM "settings"`);
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`ALTER TABLE "temporary_settings" RENAME TO "settings"`);
    }
}
