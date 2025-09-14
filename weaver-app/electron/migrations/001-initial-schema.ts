import { MigrationInterface, QueryRunner } from 'typeorm';

// Legacy filename retained due to filesystem issue; class renamed with timestamp to satisfy TypeORM.
export class InitialSchema1736920000001 implements MigrationInterface {
  name = 'InitialSchema1736920000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tasks table
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tasks" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      "title" varchar NOT NULL,
      "description" varchar,
      "date" varchar NOT NULL,
      "hours" real NOT NULL DEFAULT (0),
      "created_at" datetime NOT NULL DEFAULT (datetime('now')),
      "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
    )`);

    // Create time_entries table
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "time_entries" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      "task_id" integer,
      "date" varchar NOT NULL,
      "hours" real NOT NULL,
      "created_at" datetime NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT "FK_time_entries_task" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    )`);

    // Trigger to auto-update updated_at
    await queryRunner.query(`CREATE TRIGGER IF NOT EXISTS tasks_updated_at_trigger
      AFTER UPDATE ON tasks
      FOR EACH ROW BEGIN
        UPDATE tasks SET updated_at = datetime('now') WHERE id = OLD.id;
      END;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS tasks_updated_at_trigger');
    await queryRunner.query('DROP TABLE IF EXISTS "time_entries"');
    await queryRunner.query('DROP TABLE IF EXISTS "tasks"');
  }
}
