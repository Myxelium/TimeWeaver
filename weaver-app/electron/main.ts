import {
  app,
  BrowserWindow,
  dialog,
  ipcMain
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { syncAzureDevOps } from './ado/sync';
import { buildCommandHandlers } from './cqrs/commands';
import { buildQueryHandlers } from './cqrs/queries';
import {
  Command,
  CommandTypeKey,
  Query,
  QueryTypeKey
} from './cqrs/types';
import {
  AdoWorkItem,
  Setting,
  Task,
  TimeEntry
} from './entities';
import { settings } from './settings';
import {
  attachMainWindow,
  markSidePopupsQuitting,
  refreshSidePopups,
  shouldKeepSidePopupsAlive
} from './side-popups';

// Notification sounds play when a popup appears, without a prior click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Disable sandbox on Linux to avoid SUID issues
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

let mainWindow: BrowserWindow | null;
let applicationDataSource: DataSource | undefined;

// Database initialization
async function initializeDatabase(): Promise<void> {
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
    entities: [
      Task,
      TimeEntry,
      Setting,
      AdoWorkItem
    ],
    migrations: [__dirname + '/migrations/*.js', __dirname + '/migrations/*.ts'],
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

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false, // Disable sandbox to avoid Linux permission issues
      devTools: true
    },
    icon: path.join(__dirname, '../src/assets/icon.png'),
    titleBarStyle: 'default',
    show: false,
    autoHideMenuBar: true
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  const isDebugMode = process.env['NODE_ENV'] === 'development' || fs.existsSync('/debug') || settings.debugMode;

  if (isDebugMode) {
    await new Promise(renderer => setTimeout(renderer, 1000));

    enableDebuggingFeatures();
  }

  loadRenderer(mainWindow);
  mainWindow.webContents.once('did-finish-load', () => {
    void runScheduledAdoSync();
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();

      if (isDebugMode) {
        mainWindow.webContents.openDevTools({ mode: 'right' });
      }
    }
  });

  // Register F12 to toggle DevTools (since menu is disabled)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && mainWindow) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  attachMainWindow(mainWindow);
}

function loadRenderer(win: BrowserWindow, query?: Record<string, string>): void {
  if (process.env['NODE_ENV'] === 'development') {
    const params = new URLSearchParams(query ?? {});
    const suffix = params.toString() ? `?${params.toString()}` : '';

    void win.loadURL(`http://localhost:4200/${suffix}`);
    return;
  }

  void win.loadFile(path.join(__dirname, '../dist/weaver-app/index.html'), query ? { query } : undefined);
}

function showMainWindow(): void {
  if (!mainWindow) {
    void createWindow();
    return;
  }

  if (mainWindow.isMinimized())
    mainWindow.restore();

  mainWindow.show();
  mainWindow.focus();
}

// IPC handlers for database operations
function setupIpcHandlers(): void {
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

    const result = await handler(command);

    if (command.type === 'save-settings')
      await refreshSidePopups(sidePopupHosts());

    if (command.type === 'sync-ado' && result && typeof result === 'object' && 'ran' in result && result.ran)
      notifyAdoSynced();

    return result;
  });

  ipcMain.handle('cqrs:query', async (_evt, query: Query) => {
    const handler = queryHandlerMap[query.type as QueryTypeKey];

    if (!handler)
      throw new Error(`No query handler for ${query.type}`);

    if (query.type === 'export-csv' || query.type === 'export-csv-all') {
      const saveCsv = async (defaultName: string, content: string): Promise<boolean> => {
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
  await createWindow();
  await refreshSidePopups(sidePopupHosts());
  setInterval(() => {
    void runScheduledAdoSync();
  }, ADO_SYNC_CHECK_MS);

  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0)
      void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (shouldKeepSidePopupsAlive())
    return;

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  markSidePopupsQuitting();

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

function sidePopupHosts(): {
  getDataSource: () => DataSource | undefined;
  showMainWindow: () => void;
  loadRenderer: (win: BrowserWindow, query?: Record<string, string>) => void;
} {
  return {
    getDataSource: (): DataSource | undefined => applicationDataSource,
    showMainWindow,
    loadRenderer
  };
}

const ADO_SYNC_CHECK_MS = 60_000;

async function runScheduledAdoSync(): Promise<void> {
  if (!applicationDataSource?.isInitialized)
    return;

  const result = await syncAzureDevOps(applicationDataSource, false);

  if (result.ran)
    notifyAdoSynced();
}

function notifyAdoSynced(): void {
  if (!mainWindow || mainWindow.isDestroyed())
    return;

  mainWindow.webContents.send('ado:synced');
}

function enableDebuggingFeatures(): void {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  // Mitigate some GPU / vsync issues on headless / VM setups
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  // Better logging (shows in stdout)
  app.commandLine.appendSwitch('enable-logging');
}
