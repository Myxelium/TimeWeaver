import { DataSource } from 'typeorm';
import { Task } from '../../../entities/Task';
import { GetTasksByDateQuery } from '../../types';

export async function handleGetTasksByDate(query: GetTasksByDateQuery, dataSource: DataSource): Promise<Task[]> {
  const taskRepository = dataSource.getRepository(Task);

  return taskRepository.find({ where: { date: query.payload.date }, order: { created_at: 'DESC' } });
}
