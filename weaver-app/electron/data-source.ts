import 'reflect-metadata';

import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

import {
  AdoWorkItem,
  Setting,
  Task,
  TimeEntry
} from './entities';
import { settings } from './settings';

// This DataSource is for CLI migration generation and running.
// At runtime we dynamically resolve the userData path inside Electron main.
// For CLI we store the DB in the project root (weaver.db) so diffs are visible and migrations can be generated.

const projectRootDatabaseFilePath = path.join(__dirname, '..', settings.databaseName);

let databaseFileBuffer: Uint8Array | undefined;

if (fs.existsSync(projectRootDatabaseFilePath)) {
  databaseFileBuffer = fs.readFileSync(projectRootDatabaseFilePath);
}

export const AppDataSource = new DataSource({
  type: 'sqljs',
  database: databaseFileBuffer,
  entities: [
    Task,
    TimeEntry,
    Setting,
    AdoWorkItem
  ],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
  autoSave: true,
  location: projectRootDatabaseFilePath
});
