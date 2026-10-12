import { DataSource } from 'typeorm';

import {
  ExportAllCsvQuery,
  ExportMonthCsvQuery,
  GetAdoSuggestionsQuery,
  GetAllTasksQuery,
  GetMonthlySummaryQuery,
  GetSettingsQuery,
  GetTasksByDateQuery,
  GetTasksByMonthQuery,
  QueryType
} from '../types';
import { handleExportAllCsv } from './handlers/exportAllCsv';
import { handleExportCsv } from './handlers/exportCsv';
import { handleGetAdoSuggestions } from './handlers/getAdoSuggestions';
import { handleGetAllTasks } from './handlers/getAllTasks';
import { handleGetMonthlySummary } from './handlers/getMonthlySummary';
import { handleGetSettings } from './handlers/getSettings';
import { handleGetTasksByDate } from './handlers/getTasksByDate';
import { handleGetTasksByMonth } from './handlers/getTasksByMonth';

export function buildQueryHandlers(dataSource: DataSource): {
  [QueryType.GetTasksByDate]: (query: GetTasksByDateQuery) => ReturnType<typeof handleGetTasksByDate>;
  [QueryType.GetTasksByMonth]: (query: GetTasksByMonthQuery) => ReturnType<typeof handleGetTasksByMonth>;
  [QueryType.GetMonthlySummary]: (query: GetMonthlySummaryQuery) => ReturnType<typeof handleGetMonthlySummary>;
  [QueryType.GetAllTasks]: (query: GetAllTasksQuery) => ReturnType<typeof handleGetAllTasks>;
  [QueryType.GetSettings]: (query: GetSettingsQuery) => ReturnType<typeof handleGetSettings>;
  [QueryType.GetAdoSuggestions]: (query: GetAdoSuggestionsQuery) => ReturnType<typeof handleGetAdoSuggestions>;
  [QueryType.ExportCsv]: (
    query: ExportMonthCsvQuery,
    saveCsv: (defaultName: string, content: string) => Promise<boolean>
  ) => ReturnType<typeof handleExportCsv>;
  [QueryType.ExportCsvAll]: (
    query: ExportAllCsvQuery,
    saveCsv: (defaultName: string, content: string) => Promise<boolean>
  ) => ReturnType<typeof handleExportAllCsv>;
} {
  return {
    [QueryType.GetTasksByDate]: (query: GetTasksByDateQuery): ReturnType<typeof handleGetTasksByDate> =>
      handleGetTasksByDate(query, dataSource),
    [QueryType.GetTasksByMonth]: (query: GetTasksByMonthQuery): ReturnType<typeof handleGetTasksByMonth> =>
      handleGetTasksByMonth(query, dataSource),
    [QueryType.GetMonthlySummary]: (query: GetMonthlySummaryQuery): ReturnType<typeof handleGetMonthlySummary> =>
      handleGetMonthlySummary(query, dataSource),
    [QueryType.GetAllTasks]: (_query: GetAllTasksQuery): ReturnType<typeof handleGetAllTasks> =>
      handleGetAllTasks(dataSource),
    [QueryType.GetSettings]: (_query: GetSettingsQuery): ReturnType<typeof handleGetSettings> =>
      handleGetSettings(dataSource),
    [QueryType.GetAdoSuggestions]: (_query: GetAdoSuggestionsQuery): ReturnType<typeof handleGetAdoSuggestions> =>
      handleGetAdoSuggestions(dataSource),
    [QueryType.ExportCsv]: (
      query: ExportMonthCsvQuery,
      saveCsv: (defaultName: string, content: string) => Promise<boolean>
    ): ReturnType<typeof handleExportCsv> => handleExportCsv(query, dataSource, saveCsv),
    [QueryType.ExportCsvAll]: (
      _query: ExportAllCsvQuery,
      saveCsv: (defaultName: string, content: string) => Promise<boolean>
    ): ReturnType<typeof handleExportAllCsv> => handleExportAllCsv(dataSource, saveCsv)
  };
}
