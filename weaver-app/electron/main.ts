import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Task, TimeEntry, Setting } from './entities';
import { buildCommandHandlers } from './cqrs/commands';
import { buildQueryHandlers } from './cqrs/queries';
import { Command, Query, CommandTypeKey, QueryTypeKey } from './cqrs/types';
import { settings } from './settings';

// Disable sandbox on Linux to avoid SUID issues
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--disable-dev-shm-usage');
}

let mainWindow: BrowserWindow | null;
let applicationDataSource: DataSource | undefined;

// Database initialization
async function initializeDatabase() {
  // Use userData directory for the database in production
  const userDataPath = app.getPath('userData');
  const databaseFilePath = path.join(userDataPath, settings.databaseName);

  let database: Uint8Array | undefined;

  // Load existing database if it exists
  if (fs.existsSync(databaseFilePath)) {
    database = fs.readFileSync(databaseFilePath);
  }

  applicationDataSource = new DataSource({
    type: 'sqljs',
    database: database,
    entities: [Task, TimeEntry, Setting],
    migrations: [
      __dirname + '/migrations/*.js',
      __dirname + '/migrations/*.ts'
    ],
    synchronize: false, // Use migrations instead of auto sync
    logging: false,
    autoSave: true,
    location: databaseFilePath
  });

  try {
    await applicationDataSource.initialize();
    console.log('Database connection initialized at:', databaseFilePath);

    try {
      await applicationDataSource.runMigrations();
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
    show: false,
    autoHideMenuBar: true
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  if (process.env['NODE_ENV'] === 'development' || fs.existsSync('/debug') || settings.debugMode) {
    debuggingMode(mainWindow);
  }

  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.loadURL('http://localhost:4200');
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../dist/weaver-app/index.html')
    );
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for database operations
function setupIpcHandlers() {
  if (!applicationDataSource) {
    throw new Error('DataSource not initialized');
  }

  const commandHandlerMap = buildCommandHandlers(applicationDataSource) as Record<CommandTypeKey, (command: Command) => unknown>;

  type QueryExtraArgs = [ (defaultName: string, content: string) => Promise<boolean> ] | [];
  const queryHandlerMap = buildQueryHandlers(applicationDataSource) as Record<QueryTypeKey, (query: Query, ...extra: QueryExtraArgs) => unknown>;

  ipcMain.handle('cqrs:command', async (_evt, command: Command) => {
    const handler = commandHandlerMap[command.type as CommandTypeKey];

    if (!handler)
      throw new Error(`No command handler for ${command.type}`);

    return handler(command);
  });

  ipcMain.handle('cqrs:query', async (_evt, query: Query) => {
    const handler = queryHandlerMap[query.type as QueryTypeKey];

    if (!handler)
      throw new Error(`No query handler for ${query.type}`);

    if (query.type === 'export-csv' || query.type === 'export-csv-all') {
      const saveCsv = async (defaultName: string, content: string) => {
        if (!mainWindow)
          return false;

        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Export Time Report',
          defaultPath: defaultName,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }]
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

  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (applicationDataSource && applicationDataSource.isInitialized) {
    event.preventDefault();

    try {
      await applicationDataSource.destroy();
      console.log('Database connection closed successfully');
    } catch (error) {
      console.error('Error closing database connection:', error);
    } finally {
      applicationDataSource = undefined;
      app.quit();
    }
  }
});

function debuggingMode(BrowserWindow: BrowserWindow | null) {
  if (BrowserWindow) {
    BrowserWindow.webContents.openDevTools({ mode: 'detach' });
  }

  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  // Mitigate some GPU / vsync issues on headless / VM setups
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  // Better logging (shows in stdout)
  app.commandLine.appendSwitch('enable-logging');
}
