import {
  endOfMonth,
  format,
  startOfMonth
} from 'date-fns';
import { Between, DataSource } from 'typeorm';

import { Task } from '../../../entities/Task';
import { ExportMonthCsvQuery } from '../../types';

export async function handleExportCsv(
  query: ExportMonthCsvQuery,
  dataSource: DataSource,
  saveCsv: (defaultName: string, content: string) => Promise<boolean>
): Promise<boolean> {
  const { year, month } = query.payload;
  const monthDate = new Date(year, month - 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');
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
