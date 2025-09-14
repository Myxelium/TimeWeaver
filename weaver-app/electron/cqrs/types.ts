import { Task } from '../entities/Task';

// Command Interfaces
export interface SaveTaskCommand { type: 'save-task'; payload: { id?: number; title: string; description?: string; date: string; hours: number }; }
export interface DeleteTaskCommand { type: 'delete-task'; payload: { id: number }; }
export interface ExportMonthCsvQuery { type: 'export-csv'; payload: { year: number; month: number }; }

// Query Interfaces
export interface GetTasksByDateQuery { type: 'get-tasks-by-date'; payload: { date: string }; }
export interface GetTasksByMonthQuery { type: 'get-tasks-by-month'; payload: { year: number; month: number }; }
export interface GetMonthlySummaryQuery { type: 'get-monthly-summary'; payload: { year: number; month: number }; }
export interface GetAllTasksQuery { type: 'get-all-tasks'; payload: {}; }

export type Command = SaveTaskCommand | DeleteTaskCommand;
export type Query = GetTasksByDateQuery | GetTasksByMonthQuery | GetMonthlySummaryQuery | GetAllTasksQuery | ExportMonthCsvQuery;

export interface DaySummaryDTO {
  date: string;
  total_hours: number;
  task_count: number;
  tasks: Task[];
}
