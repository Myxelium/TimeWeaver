import { contextBridge, ipcRenderer } from 'electron';

import { Command, Query } from './cqrs/types';

export interface CqrsAPI {
  runCommand: <T = unknown>(command: Command) => Promise<T>;
  runQuery: <T = unknown>(query: Query) => Promise<T>;
  onAdoSynced: (listener: () => void) => () => void;
  openExternal: (url: string) => Promise<void>;
}

export interface PopupEntryPayload {
  title: string;
  hours: number;
}

export interface PopupContextPayload {
  ruleId: string;
  type: 'time-log' | 'reminder';
  message: string;
  durationSeconds: number;
  darkMode: boolean;
  today: string;
  previousDate: string | null;
  targetHours: number;
  todayHours: number;
  remainingHours: number;
  previousTitles: string[];
  recentTitles: string[];
}

export interface PopupAPI {
  getContext: (ruleId: string) => Promise<PopupContextPayload>;
  submitTimeEntries: (ruleId: string, entries: PopupEntryPayload[]) => Promise<boolean>;
  dismissPopup: (ruleId: string) => Promise<boolean>;
  resizePopup: (height: number) => void;
}

const cqrsAPI: CqrsAPI = {
  runCommand: <T = unknown>(command: Command): Promise<T> => ipcRenderer.invoke('cqrs:command', command) as Promise<T>,
  runQuery: <T = unknown>(query: Query): Promise<T> => ipcRenderer.invoke('cqrs:query', query) as Promise<T>,
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),
  onAdoSynced: (listener: () => void): (() => void) => {
    const wrapped = (): void => listener();

    ipcRenderer.on('ado:synced', wrapped);

    return (): void => {
      ipcRenderer.removeListener('ado:synced', wrapped);
    };
  }
};
const popupAPI: PopupAPI = {
  getContext: (ruleId): Promise<PopupContextPayload> => ipcRenderer.invoke('popup:get-context', ruleId),
  submitTimeEntries: (ruleId, entries): Promise<boolean> => ipcRenderer.invoke('popup:submit', { ruleId, entries }),
  dismissPopup: (ruleId): Promise<boolean> => ipcRenderer.invoke('popup:dismiss', ruleId),
  resizePopup: (height): void => ipcRenderer.send('popup:resize', height)
};

contextBridge.exposeInMainWorld('electronAPI', cqrsAPI);
contextBridge.exposeInMainWorld('popupAPI', popupAPI);

declare global {
  interface Window {
    electronAPI: CqrsAPI;
    popupAPI: PopupAPI;
  }
}
