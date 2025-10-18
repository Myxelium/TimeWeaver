import { DataSource } from 'typeorm';
import { Task } from '../../../entities/Task';

export async function handleGetAllTasks(dataSource: DataSource) {
  const taskRepository = dataSource.getRepository(Task);
  return taskRepository.find({ order: { date: 'DESC', created_at: 'DESC' } });
}
