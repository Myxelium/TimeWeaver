import { Task } from '../entities/Task';

// Centralized names to avoid scattered string literals
export const CommandType = {
  SaveTask: 'save-task',
  DeleteTask: 'delete-task'
} as const;

export const QueryType = {
  GetTasksByDate: 'get-tasks-by-date',
  GetTasksByMonth: 'get-tasks-by-month',
  GetMonthlySummary: 'get-monthly-summary',
  GetAllTasks: 'get-all-tasks',
  ExportCsv: 'export-csv'
} as const;

export type CommandTypeKey = typeof CommandType[keyof typeof CommandType];
export type QueryTypeKey = typeof QueryType[keyof typeof QueryType];

// Command Interfaces
export interface SaveTaskCommand { type: typeof CommandType.SaveTask; payload: { id?: number; title: string; description?: string; date: string; hours: number }; }
export interface DeleteTaskCommand { type: typeof CommandType.DeleteTask; payload: { id: number }; }
export interface ExportMonthCsvQuery { type: typeof QueryType.ExportCsv; payload: { year: number; month: number }; }

// Query Interfaces
export interface GetTasksByDateQuery { type: typeof QueryType.GetTasksByDate; payload: { date: string }; }
export interface GetTasksByMonthQuery { type: typeof QueryType.GetTasksByMonth; payload: { year: number; month: number }; }
export interface GetMonthlySummaryQuery { type: typeof QueryType.GetMonthlySummary; payload: { year: number; month: number }; }
export interface GetAllTasksQuery { type: typeof QueryType.GetAllTasks; payload: {}; }

export type Command = SaveTaskCommand | DeleteTaskCommand;
export type Query = GetTasksByDateQuery | GetTasksByMonthQuery | GetMonthlySummaryQuery | GetAllTasksQuery | ExportMonthCsvQuery;

export interface DaySummaryDTO {
  date: string;
  total_hours: number;
  task_count: number;
  tasks: Task[];
}
