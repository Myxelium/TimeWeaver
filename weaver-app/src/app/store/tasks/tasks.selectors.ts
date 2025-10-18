import { createFeatureSelector, createSelector } from '@ngrx/store';
import { tasksFeatureKey } from './tasks.reducer';
import { TasksState } from './tasks.state';

export const selectTasksState = createFeatureSelector<TasksState>(tasksFeatureKey);
export const selectCurrentDate = createSelector(selectTasksState, s => s.currentDate);
export const selectSelectedMonth = createSelector(selectTasksState, s => s.selectedMonth);
export const selectTodayTasks = createSelector(selectTasksState, s => s.todayTasks);
export const selectMonthlyData = createSelector(selectTasksState, s => s.monthlyData);
export const selectAllTasks = createSelector(selectTasksState, s => s.allTasks);
export const selectMonthlySummary = createSelector(selectTasksState, s => s.monthlySummary);
export const selectIsLoading = createSelector(selectTasksState, s => s.isLoading);
export const selectError = createSelector(selectTasksState, s => s.error);
