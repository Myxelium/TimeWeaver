import { contextBridge, ipcRenderer } from 'electron';
import { Command, Query } from './cqrs/types';

export interface CqrsAPI {
  command: <T = unknown>(command: Command) => Promise<T>;
  query: <T = unknown>(query: Query) => Promise<T>;
}

const cqrsAPI: CqrsAPI = {
  command: (command) => ipcRenderer.invoke('cqrs:command', command),
  query: (query) => ipcRenderer.invoke('cqrs:query', query)
};

contextBridge.exposeInMainWorld('electronAPI', cqrsAPI);

declare global {
  interface Window {
    electronAPI: CqrsAPI;
  }
}
