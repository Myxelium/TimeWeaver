import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import 'reflect-metadata';
import { DataSource, Between } from 'typeorm';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Task, TimeEntry } from './entities';

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
  
  dataSource = new DataSource({
    type: 'sqlite',
    database: dbPath,
    entities: [Task, TimeEntry],
    synchronize: true, // Auto-create tables
    logging: false
  });

  try {
    await dataSource.initialize();
    console.log('Database connection initialized at:', dbPath);
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
  // Get tasks for a specific date
  ipcMain.handle('get-tasks-by-date', async (event, date: string) => {
    const taskRepository = dataSource.getRepository(Task);
    return await taskRepository.find({
      where: { date },
      order: { created_at: 'DESC' }
    });
  });

  // Save or update task
  ipcMain.handle('save-task', async (event, taskData: any) => {
    const taskRepository = dataSource.getRepository(Task);
    
    if (taskData.id) {
      // Update existing task
      await taskRepository.update(taskData.id, {
        title: taskData.title,
        description: taskData.description,
        hours: taskData.hours
      });
      return taskData.id;
    } else {
      // Create new task
      const task = taskRepository.create({
        title: taskData.title,
        description: taskData.description,
        date: taskData.date,
        hours: taskData.hours
      });
      const result = await taskRepository.save(task);
      return result.id;
    }
  });

  // Delete task
  ipcMain.handle('delete-task', async (event, taskId: number) => {
    const taskRepository = dataSource.getRepository(Task);
    return await taskRepository.delete(taskId);
  });

  // Get tasks for a date range (for month view)
  ipcMain.handle('get-tasks-by-month', async (event, year: number, month: number) => {
    const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    
    const taskRepository = dataSource.getRepository(Task);
    
    // Get summary data using query builder
    const summaryData = await taskRepository
      .createQueryBuilder('task')
      .select('task.date', 'date')
      .addSelect('SUM(task.hours)', 'total_hours')
      .addSelect('COUNT(*)', 'task_count')
      .where('task.date >= :startDate AND task.date <= :endDate', { startDate, endDate })
      .groupBy('task.date')
      .orderBy('task.date')
      .getRawMany();
    
    // Get all tasks for the month using Between operator
    const allTasks = await taskRepository.find({
      where: {
        date: Between(startDate, endDate)
      },
      order: { date: 'ASC', created_at: 'DESC' }
    });
    
    // Group tasks by date
    const tasksByDate: { [key: string]: Task[] } = {};
    allTasks.forEach(task => {
      if (!tasksByDate[task.date]) {
        tasksByDate[task.date] = [];
      }
      tasksByDate[task.date].push(task);
    });
    
    // Combine summary data with tasks
    return summaryData.map((summary: any) => ({
      date: summary.date,
      total_hours: parseFloat(summary.total_hours) || 0,
      task_count: parseInt(summary.task_count) || 0,
      tasks: tasksByDate[summary.date] || []
    }));
  });

  // Get all tasks (for all records view)
  ipcMain.handle('get-all-tasks', async () => {
    const taskRepository = dataSource.getRepository(Task);
    return await taskRepository.find({
      order: { date: 'DESC', created_at: 'DESC' }
    });
  });

  // Get monthly summary
  ipcMain.handle('get-monthly-summary', async (event, year: number, month: number) => {
    const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    
    const taskRepository = dataSource.getRepository(Task);
    const result = await taskRepository
      .createQueryBuilder('task')
      .select('SUM(task.hours)', 'total_hours')
      .where('task.date >= :startDate AND task.date <= :endDate', { startDate, endDate })
      .getRawOne();
    
    return parseFloat(result?.total_hours) || 0;
  });

  // Export to CSV
  ipcMain.handle('export-csv', async (event, year: number, month: number) => {
    const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    
    const taskRepository = dataSource.getRepository(Task);
    const tasks = await taskRepository.find({
      where: {
        date: Between(startDate, endDate)
      },
      order: { date: 'ASC', created_at: 'ASC' }
    });
    
    // Convert to CSV format
    const csvHeader = 'Date,Title,Description,Hours,Created At\n';
    const csvData = tasks.map((task: Task) => 
      `"${task.date}","${task.title}","${task.description || ''}","${task.hours}","${task.created_at}"`
    ).join('\n');
    
    const csvContent = csvHeader + csvData;
    
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Time Report',
      defaultPath: `weaver-report-${year}-${month.toString().padStart(2, '0')}.csv`,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, csvContent, 'utf8');
      return true;
    }
    return false;
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