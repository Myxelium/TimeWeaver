import {
  endOfMonth,
  format,
  startOfMonth
} from 'date-fns';
import { DataSource } from 'typeorm';

import { Task } from '../../../entities/Task';
import { GetMonthlySummaryQuery } from '../../types';

interface MonthlySummaryRawRow {
  total_hours: string | null;
}

export async function handleGetMonthlySummary(query: GetMonthlySummaryQuery, dataSource: DataSource): Promise<number> {
  const { year, month } = query.payload;
  const monthDate = new Date(year, month - 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');
  const taskRepository = dataSource.getRepository(Task);
  const result = await taskRepository.createQueryBuilder('task')
    .select('SUM(task.hours)', 'total_hours')
    .where('task.date >= :startDate AND task.date <= :endDate', { startDate, endDate })
    .getRawOne<MonthlySummaryRawRow>();

  return parseFloat(result?.total_hours || '0') || 0;
}
