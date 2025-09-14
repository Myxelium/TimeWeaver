import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Task, TimeEntry } from './entities';
import * as path from 'path';
import * as fs from 'fs';

// This DataSource is for CLI migration generation and running.
// At runtime we dynamically resolve the userData path inside Electron main.
// For CLI we store the DB in the project root (weaver.db) so diffs are visible and migrations can be generated.

const projectRootDbPath = path.join(__dirname, '..', 'weaver.db');
let database: Uint8Array | undefined;
if (fs.existsSync(projectRootDbPath)) {
  database = fs.readFileSync(projectRootDbPath);
}

export const AppDataSource = new DataSource({
  type: 'sqljs',
  database,
  entities: [Task, TimeEntry],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
  autoSave: true,
  location: projectRootDbPath
});