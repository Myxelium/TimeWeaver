import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Task, TimeEntry } from './entities';
import { commandHandlers } from './cqrs/commands/handlers';
import { queryHandlers } from './cqrs/queries/handlers';
import { Command, Query } from './cqrs/types';

// Disable sandbox on Linux to avoid SUID issues
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--disable-dev-shm-usage');
}

let mainWindow: BrowserWindow;
let dataSource: DataSource;

// Database initialization
async function initializeDatabase() {
  // Use userData directory for the database in production
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'weaver.db');
  
  let database: Uint8Array | undefined;
  
  // Load existing database if it exists
  if (fs.existsSync(dbPath)) {
    database = fs.readFileSync(dbPath);
  }
  
  dataSource = new DataSource({
    type: 'sqljs',
    database: database,
    entities: [Task, TimeEntry],
    migrations: [__dirname + '/migrations/*.js', __dirname + '/migrations/*.ts'],
    synchronize: false, // Use migrations instead of auto sync
    logging: false,
    autoSave: true,
    location: dbPath
  });

  try {
    await dataSource.initialize();
    console.log('Database connection initialized at:', dbPath);
    try {
      await dataSource.runMigrations();
      console.log('Migrations executed');
    } catch (migErr) {
      console.error('Migration error:', migErr);
    }
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false // Disable sandbox to avoid Linux permission issues
    },
    icon: path.join(__dirname, '../src/assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/weaver-app/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null as any;
  });
}

// IPC handlers for database operations
function setupIpcHandlers() {
  const cmdHandlers = commandHandlers(dataSource);
  const qryHandlers = queryHandlers(dataSource);

  ipcMain.handle('cqrs:command', async (_evt, command: Command) => {
    const handler = (cmdHandlers as any)[command.type];
    if (!handler) throw new Error(`No command handler for ${command.type}`);
    return handler(command);
  });

  ipcMain.handle('cqrs:query', async (_evt, query: Query) => {
    const handler = (qryHandlers as any)[query.type];
    if (!handler) throw new Error(`No query handler for ${query.type}`);
    if (query.type === 'export-csv') {
      const saveCsv = async (defaultName: string, content: string) => {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Export Time Report',
            defaultPath: defaultName,
            filters: [ { name: 'CSV Files', extensions: ['csv'] } ]
        });
        if (!result.canceled && result.filePath) {
          fs.writeFileSync(result.filePath, content, 'utf8');
          return true;
        }
        return false;
      };
      return handler(query, saveCsv);
    }
    return handler(query);
  });
}

app.whenReady().then(async () => {
  await initializeDatabase();
  setupIpcHandlers();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (dataSource && dataSource.isInitialized) {
    event.preventDefault();
    try {
      await dataSource.destroy();
      console.log('Database connection closed successfully');
    } catch (error) {
      console.error('Error closing database connection:', error);
    } finally {
      dataSource = null as any;
      app.quit();
    }
  }
});