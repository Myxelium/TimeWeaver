import { DataSource } from 'typeorm';

import {
  CommandType,
  DeleteTaskCommand,
  ImportCsvCommand,
  SaveSettingsCommand,
  SaveTaskCommand,
  SyncAdoCommand
} from '../types';
import { handleDeleteTask } from './handlers/deleteTask';
import { handleImportCsv } from './handlers/importCsv';
import { handleSaveSettings } from './handlers/saveSettings';
import { handleSaveTask } from './handlers/saveTask';
import { handleSyncAdo } from './handlers/syncAdo';

export function buildCommandHandlers(dataSource: DataSource): {
  [CommandType.SaveTask]: (command: SaveTaskCommand) => ReturnType<typeof handleSaveTask>;
  [CommandType.DeleteTask]: (command: DeleteTaskCommand) => ReturnType<typeof handleDeleteTask>;
  [CommandType.SaveSettings]: (command: SaveSettingsCommand) => ReturnType<typeof handleSaveSettings>;
  [CommandType.ImportCsv]: (command: ImportCsvCommand) => ReturnType<typeof handleImportCsv>;
  [CommandType.SyncAdo]: (command: SyncAdoCommand) => ReturnType<typeof handleSyncAdo>;
} {
  return {
    [CommandType.SaveTask]: (command: SaveTaskCommand): ReturnType<typeof handleSaveTask> => handleSaveTask(command, dataSource),
    [CommandType.DeleteTask]: (command: DeleteTaskCommand): ReturnType<typeof handleDeleteTask> => handleDeleteTask(command, dataSource),
    [CommandType.SaveSettings]: (command: SaveSettingsCommand): ReturnType<typeof handleSaveSettings> => handleSaveSettings(command, dataSource),
    [CommandType.ImportCsv]: (command: ImportCsvCommand): ReturnType<typeof handleImportCsv> => handleImportCsv(command, dataSource),
    [CommandType.SyncAdo]: (command: SyncAdoCommand): ReturnType<typeof handleSyncAdo> => handleSyncAdo(command, dataSource)
  };
}
