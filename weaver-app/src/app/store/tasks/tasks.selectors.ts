import { createFeatureSelector, createSelector } from '@ngrx/store';

import { Task } from '../../shared/models';
import { tasksFeatureKey } from './tasks.reducer';
import { TasksState } from './tasks.state';

const yearMonthKeyLength = 7;

export const selectTasksState = createFeatureSelector<TasksState>(tasksFeatureKey);
export const selectCurrentDate = createSelector(selectTasksState, state => state.currentDate);
export const selectSelectedMonth = createSelector(selectTasksState, state => state.selectedMonth);
export const selectTodayTasks = createSelector(selectTasksState, state => state.todayTasks);
export const selectMonthlyData = createSelector(selectTasksState, state => state.monthlyData);
export const selectAllTasks = createSelector(selectTasksState, state => state.allTasks);
export const selectAdoSuggestions = createSelector(selectTasksState, state => state.adoSuggestions);
export const selectMonthlySummary = createSelector(selectTasksState, state => state.monthlySummary);
export const selectIsLoading = createSelector(selectTasksState, state => state.isLoading);
export const selectError = createSelector(selectTasksState, state => state.error);

export interface TaskStatistics {
  totalTasks: number;
  totalHours: number;
  averageHoursPerTask: number;
  averageHoursPerDay: number;
  uniqueDays: number;
  dateRange: { start: string | null; end: string | null };
}

export function calculateTaskStatistics(tasks: Task[] | null | undefined): TaskStatistics {
  if (!tasks || tasks.length === 0) {
    return {
      totalTasks: 0,
      totalHours: 0,
      averageHoursPerTask: 0,
      averageHoursPerDay: 0,
      uniqueDays: 0,
      dateRange: { start: null, end: null }
    };
  }

  const totalHours = tasks.reduce((sum, task) => sum + (task.hours || 0), 0);
  const uniqueDates = new Set(tasks.map(task => task.date));
  const sortedDates = Array.from(uniqueDates).sort();

  return {
    totalTasks: tasks.length,
    totalHours: Math.round(totalHours * 100) / 100,
    averageHoursPerTask: Math.round((totalHours / tasks.length) * 100) / 100,
    averageHoursPerDay: Math.round((totalHours / uniqueDates.size) * 100) / 100,
    uniqueDays: uniqueDates.size,
    dateRange: {
      start: sortedDates[0] || null,
      end: sortedDates[sortedDates.length - 1] || null
    }
  };
}

export const selectTaskStatistics = createSelector(
  selectAllTasks,
  calculateTaskStatistics
);

export const selectTasksByMonth = createSelector(
  selectAllTasks,
  (tasks: Task[]) => {
    const monthMap = new Map<string, { tasks: Task[]; hours: number }>();

    tasks.forEach(task => {
      const monthKey = task.date.substring(0, yearMonthKeyLength);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { tasks: [], hours: 0 });
      }

      const monthData = monthMap.get(monthKey);

      if (monthData) {
        monthData.tasks.push(task);
        monthData.hours += task.hours || 0;
      }
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        taskCount: data.tasks.length,
        totalHours: Math.round(data.hours * 100) / 100
      }))
      .sort((monthA, monthB) => monthB.month.localeCompare(monthA.month));
  }
);
