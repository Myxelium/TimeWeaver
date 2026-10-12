import { contextBridge, ipcRenderer } from 'electron';

import { Command, Query } from './cqrs/types';

export interface CqrsAPI {
  command: <T = unknown>(command: Command) => Promise<T>;
  query: <T = unknown>(query: Query) => Promise<T>;
  onAdoSynced: (listener: () => void) => () => void;
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
  submit: (ruleId: string, entries: PopupEntryPayload[]) => Promise<boolean>;
  dismiss: (ruleId: string) => Promise<boolean>;
  resize: (height: number) => void;
}

const cqrsAPI: CqrsAPI = {
  command: <T = unknown>(command: Command): Promise<T> => ipcRenderer.invoke('cqrs:command', command) as Promise<T>,
  query: <T = unknown>(query: Query): Promise<T> => ipcRenderer.invoke('cqrs:query', query) as Promise<T>,
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
  submit: (ruleId, entries): Promise<boolean> => ipcRenderer.invoke('popup:submit', { ruleId, entries }),
  dismiss: (ruleId): Promise<boolean> => ipcRenderer.invoke('popup:dismiss', ruleId),
  resize: (height): void => ipcRenderer.send('popup:resize', height)
};

contextBridge.exposeInMainWorld('electronAPI', cqrsAPI);
contextBridge.exposeInMainWorld('popupAPI', popupAPI);

declare global {
  interface Window {
    electronAPI: CqrsAPI;
    popupAPI: PopupAPI;
  }
}
