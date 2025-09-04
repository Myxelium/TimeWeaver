import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
export interface ElectronAPI {
  // Task operations
  getTasksByDate: (date: string) => Promise<any[]>;
  saveTask: (task: any) => Promise<number>;
  deleteTask: (taskId: number) => Promise<any>;
  
  // Monthly operations
  getTasksByMonth: (year: number, month: number) => Promise<any[]>;
  getMonthlySummary: (year: number, month: number) => Promise<number>;
  
  // Data operations
  getAllTasks: () => Promise<any[]>;
  exportCsv: (year: number, month: number) => Promise<boolean>;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  getTasksByDate: (date: string) => ipcRenderer.invoke('get-tasks-by-date', date),
  saveTask: (task: any) => ipcRenderer.invoke('save-task', task),
  deleteTask: (taskId: number) => ipcRenderer.invoke('delete-task', taskId),
  getTasksByMonth: (year: number, month: number) => ipcRenderer.invoke('get-tasks-by-month', year, month),
  getMonthlySummary: (year: number, month: number) => ipcRenderer.invoke('get-monthly-summary', year, month),
  getAllTasks: () => ipcRenderer.invoke('get-all-tasks'),
  exportCsv: (year: number, month: number) => ipcRenderer.invoke('export-csv', year, month),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for global window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}