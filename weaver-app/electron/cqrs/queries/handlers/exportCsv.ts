import { DataSource, Between } from 'typeorm';
import { Task } from '../../../entities/Task';
import { ExportMonthCsvQuery } from '../../types';
import {
  format,
  startOfMonth,
  endOfMonth
} from 'date-fns';

export async function handleExportCsv(
  query: ExportMonthCsvQuery,
  dataSource: DataSource,
  saveCsv: (defaultName: string, content: string) => Promise<boolean>
): Promise<boolean> {
  const { year, month } = query.payload;
  const startDate = format(
    startOfMonth(new Date(year, month - 1)),
    'yyyy-MM-dd'
  );
  const endDate = format(
    endOfMonth(new Date(year, month - 1)),
    'yyyy-MM-dd'
  );
  const taskRepository = dataSource.getRepository(Task);
  const tasks = await taskRepository.find({
    where: { date: Between(startDate, endDate) },
    order: { date: 'ASC', created_at: 'ASC' }
  });
  const header = 'Date,Title,Description,Hours,Created At\n';
  const body = tasks
    .map(taskEntity =>
      `"${taskEntity.date}","${taskEntity.title}","${taskEntity.description || ''}","${taskEntity.hours}","${taskEntity.created_at}"`
    )
    .join('\n');

  return saveCsv(
    `weaver-report-${year}-${month.toString().padStart(2, '0')}.csv`,
    header + body
  );
}
