import { DataSource } from 'typeorm';
import { QueryType, GetTasksByDateQuery, GetTasksByMonthQuery, GetMonthlySummaryQuery, GetAllTasksQuery, ExportMonthCsvQuery } from '../types';
import { handleGetTasksByDate } from './handlers/getTasksByDate';
import { handleGetTasksByMonth } from './handlers/getTasksByMonth';
import { handleGetMonthlySummary } from './handlers/getMonthlySummary';
import { handleGetAllTasks } from './handlers/getAllTasks';
import { handleExportCsv } from './handlers/exportCsv';

export const buildQueryHandlers = (dataSource: DataSource) => ({
  [QueryType.GetTasksByDate]: (query: GetTasksByDateQuery) => handleGetTasksByDate(query, dataSource),
  [QueryType.GetTasksByMonth]: (query: GetTasksByMonthQuery) => handleGetTasksByMonth(query, dataSource),
  [QueryType.GetMonthlySummary]: (query: GetMonthlySummaryQuery) => handleGetMonthlySummary(query, dataSource),
  [QueryType.GetAllTasks]: (_query: GetAllTasksQuery) => handleGetAllTasks(dataSource),
  [QueryType.ExportCsv]: (query: ExportMonthCsvQuery, saveCsv: (defaultName: string, content: string) => Promise<boolean>) => handleExportCsv(query, dataSource, saveCsv)
});
