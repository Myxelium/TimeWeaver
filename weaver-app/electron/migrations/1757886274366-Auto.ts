import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1757886274366 implements MigrationInterface {
    name = 'Auto1757886274366'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "title" varchar NOT NULL, "description" varchar, "date" varchar NOT NULL, "hours" real NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "time_entries" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "task_id" integer, "date" varchar NOT NULL, "hours" real NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "settings" ("id" integer PRIMARY KEY NOT NULL, "monthlyIncome" real NOT NULL DEFAULT (0), "monthlyCost" real NOT NULL DEFAULT (0), "darkMode" boolean NOT NULL DEFAULT (0), "ignoreWeekends" boolean NOT NULL DEFAULT (1), "updated_at" datetime DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "temporary_time_entries" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "task_id" integer, "date" varchar NOT NULL, "hours" real NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_104aa11ede7c8d5afbbe1fdbb24" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_entries"("id", "task_id", "date", "hours", "created_at") SELECT "id", "task_id", "date", "hours", "created_at" FROM "time_entries"`);
        await queryRunner.query(`DROP TABLE "time_entries"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_entries" RENAME TO "time_entries"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "time_entries" RENAME TO "temporary_time_entries"`);
        await queryRunner.query(`CREATE TABLE "time_entries" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "task_id" integer, "date" varchar NOT NULL, "hours" real NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "time_entries"("id", "task_id", "date", "hours", "created_at") SELECT "id", "task_id", "date", "hours", "created_at" FROM "temporary_time_entries"`);
        await queryRunner.query(`DROP TABLE "temporary_time_entries"`);
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`DROP TABLE "time_entries"`);
        await queryRunner.query(`DROP TABLE "tasks"`);
    }

}
