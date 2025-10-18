import { DataSource } from 'typeorm';
import { Task } from '../../../entities/Task';
import { DeleteTaskCommand } from '../../types';

export async function handleDeleteTask(command: DeleteTaskCommand, dataSource: DataSource): Promise<boolean> {
  const taskRepository = dataSource.getRepository(Task);
  await taskRepository.delete(command.payload.id);
  return true;
}
