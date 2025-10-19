import { DataSource } from 'typeorm';
import { Task } from '../../../entities/Task';
import { SaveTaskCommand } from '../../types';

export async function handleSaveTask(command: SaveTaskCommand, dataSource: DataSource): Promise<number> {
  // Type is assumed validated by dispatcher
  const taskRepository = dataSource.getRepository(Task);
  const { id, title, description, date, hours } = command.payload;

  if (id) {
    await taskRepository.update(id, { title, description, date, hours });
    return id;
  }

  const newTaskEntity = taskRepository.create({ title, description, date, hours });
  const savedTask: Task = await taskRepository.save(newTaskEntity);

  return savedTask.id;
}
