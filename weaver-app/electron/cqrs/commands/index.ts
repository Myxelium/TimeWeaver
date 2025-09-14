import { DataSource } from 'typeorm';
import { CommandType, SaveTaskCommand, DeleteTaskCommand, SaveSettingsCommand } from '../types';
import { handleSaveTask } from './handlers/saveTask';
import { handleDeleteTask } from './handlers/deleteTask';
import { handleSaveSettings } from './handlers/saveSettings';

export const buildCommandHandlers = (dataSource: DataSource) => ({
  [CommandType.SaveTask]: (command: SaveTaskCommand) => handleSaveTask(command, dataSource),
  [CommandType.DeleteTask]: (command: DeleteTaskCommand) => handleDeleteTask(command, dataSource),
  [CommandType.SaveSettings]: (command: SaveSettingsCommand) => handleSaveSettings(command, dataSource)
});
