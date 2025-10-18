import { DataSource } from 'typeorm';
import { Task } from '../../../entities/Task';

export async function handleExportAllCsv(
  dataSource: DataSource,
  saveCsv: (defaultName: string, content: string) => Promise<boolean>
): Promise<boolean> {
  const taskRepository = dataSource.getRepository(Task);
  const tasks = await taskRepository.find({ order: { date: 'ASC', created_at: 'ASC' } });

  const header = 'Date,Title,Description,Hours,Created At\n';
  const body = tasks
    .map(taskEntity =>
      `"${taskEntity.date}","${taskEntity.title}","${taskEntity.description || ''}","${taskEntity.hours}","${taskEntity.created_at}"`
    )
    .join('\n');

  return saveCsv(
    'weaver-report-all.csv',
    header + body
  );
}
