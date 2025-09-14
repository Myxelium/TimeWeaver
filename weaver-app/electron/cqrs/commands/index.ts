import { DataSource } from 'typeorm';
import { CommandType, SaveTaskCommand, DeleteTaskCommand } from '../types';
import { handleSaveTask } from './handlers/saveTask';
import { handleDeleteTask } from './handlers/deleteTask';

export const buildCommandHandlers = (dataSource: DataSource) => ({
  [CommandType.SaveTask]: (command: SaveTaskCommand) => handleSaveTask(command, dataSource),
  [CommandType.DeleteTask]: (command: DeleteTaskCommand) => handleDeleteTask(command, dataSource)
});
