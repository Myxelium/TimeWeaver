import { Task } from '../entities/Task';
import { PopupRule } from '../popup-rules';

// Centralized names to avoid scattered string literals
export const CommandType = {
  SaveTask: 'save-task',
  DeleteTask: 'delete-task',
  SaveSettings: 'save-settings',
  ImportCsv: 'import-csv'
} as const;

export const QueryType = {
  GetTasksByDate: 'get-tasks-by-date',
  GetTasksByMonth: 'get-tasks-by-month',
  GetMonthlySummary: 'get-monthly-summary',
  GetAllTasks: 'get-all-tasks',
  ExportCsv: 'export-csv',
  ExportCsvAll: 'export-csv-all',
  GetSettings: 'get-settings'
} as const;

export type CommandTypeKey = typeof CommandType[keyof typeof CommandType];
export type QueryTypeKey = typeof QueryType[keyof typeof QueryType];

// Command Interfaces
export interface SaveTaskCommand {
  type: typeof CommandType.SaveTask;
  payload: {
    id?: number;
    title: string;
    description?: string;
    date: string;
    hours: number;
  };
}

export interface DeleteTaskCommand {
  type: typeof CommandType.DeleteTask;
  payload: { id: number };
}

export interface SaveSettingsCommand {
  type: typeof CommandType.SaveSettings;
  payload: {
    monthlyIncome: number;
    monthlyCost: number;
    darkMode: boolean;
    ignoreWeekends: boolean;
    maxHoursPerDay: number;
    maxHoursEnabled: boolean;
    holidayCountry?: string;
    holidayTypes?: string[]; // Array of holiday types: public, bank, school, optional, observance
    firstDayOfWeek?: number;
    overtimeRate?: number;
    launchAtLogin?: boolean;
    popupRules?: PopupRule[];
  };
}

export interface ImportCsvCommand {
  type: typeof CommandType.ImportCsv;
  payload: {
    contentBase64: string; // CSV file content encoded in base64
    overwrite: boolean; // if true, existing tasks on same date+title replaced/overwritten
  };
}

export interface ExportMonthCsvQuery {
  type: typeof QueryType.ExportCsv;
  payload: { year: number; month: number };
}

export interface ExportAllCsvQuery {
  type: typeof QueryType.ExportCsvAll;
  payload: Record<string, never>;
}

// Query Interfaces
export interface GetTasksByDateQuery {
  type: typeof QueryType.GetTasksByDate;
  payload: { date: string };
}
export interface GetTasksByMonthQuery {
  type: typeof QueryType.GetTasksByMonth;
  payload: { year: number; month: number };
}
export interface GetMonthlySummaryQuery {
  type: typeof QueryType.GetMonthlySummary;
  payload: { year: number; month: number };
}
export interface GetAllTasksQuery {
  type: typeof QueryType.GetAllTasks;
  payload: Record<string, never>;
}
export interface GetSettingsQuery {
  type: typeof QueryType.GetSettings;
  payload: Record<string, never>;
}

export type Command = SaveTaskCommand | DeleteTaskCommand | SaveSettingsCommand | ImportCsvCommand;
export type Query =
  | GetTasksByDateQuery
  | GetTasksByMonthQuery
  | GetMonthlySummaryQuery
  | GetAllTasksQuery
  | ExportMonthCsvQuery
  | ExportAllCsvQuery
  | GetSettingsQuery;

export interface DaySummaryDTO {
  date: string;
  total_hours: number;
  task_count: number;
  tasks: Task[];
}

export interface SettingsDTO {
  monthlyIncome: number;
  monthlyCost: number;
  darkMode: boolean;
  ignoreWeekends: boolean;
  maxHoursPerDay: number;
  maxHoursEnabled: boolean;
  holidayCountry?: string;
  holidayTypes?: string[]; // Array of holiday types: public, bank, school, optional, observance
  firstDayOfWeek?: number;
  overtimeRate?: number;
  launchAtLogin: boolean;
  popupRules: PopupRule[];
}
