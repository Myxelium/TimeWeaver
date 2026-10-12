import {
  endOfMonth,
  format,
  startOfMonth
} from 'date-fns';
import { Between, DataSource } from 'typeorm';

import { Task } from '../../../entities/Task';
import { DaySummaryDTO, GetTasksByMonthQuery } from '../../types';

export async function handleGetTasksByMonth(query: GetTasksByMonthQuery, dataSource: DataSource): Promise<DaySummaryDTO[]> {
  const { year, month } = query.payload;
  const monthDate = new Date(year, month - 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');
  const taskRepository = dataSource.getRepository(Task);
  const summaryRows = await taskRepository.createQueryBuilder('task')
    .select('task.date', 'date')
    .addSelect('SUM(task.hours)', 'total_hours')
    .addSelect('COUNT(*)', 'task_count')
    .where('task.date >= :startDate AND task.date <= :endDate', { startDate, endDate })
    .groupBy('task.date')
    .orderBy('task.date')
    .getRawMany();
  const allTasks = await taskRepository.find({ where: { date: Between(startDate, endDate) }, order: { date: 'ASC', created_at: 'DESC' } });
  const tasksIndexedByDate: Record<string, Task[]> = {};

  allTasks.forEach(taskEntity => {
    (tasksIndexedByDate[taskEntity.date] ||= []).push(taskEntity);
  });

  return summaryRows.map(row => ({
    date: row.date,
    total_hours: parseFloat(row.total_hours) || 0,
    task_count: parseInt(row.task_count) || 0,
    tasks: tasksIndexedByDate[row.date] || []
  })) as DaySummaryDTO[];
}
