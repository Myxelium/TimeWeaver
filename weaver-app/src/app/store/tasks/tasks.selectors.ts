import { createFeatureSelector, createSelector } from '@ngrx/store';
import { tasksFeatureKey } from './tasks.reducer';
import { TasksState } from './tasks.state';

export const selectTasksState = createFeatureSelector<TasksState>(tasksFeatureKey);
export const selectCurrentDate = createSelector(selectTasksState, state => state.currentDate);
export const selectSelectedMonth = createSelector(selectTasksState, state => state.selectedMonth);
export const selectTodayTasks = createSelector(selectTasksState, state => state.todayTasks);
export const selectMonthlyData = createSelector(selectTasksState, state => state.monthlyData);
export const selectAllTasks = createSelector(selectTasksState, state => state.allTasks);
export const selectMonthlySummary = createSelector(selectTasksState, state => state.monthlySummary);
export const selectIsLoading = createSelector(selectTasksState, state => state.isLoading);
export const selectError = createSelector(selectTasksState, state => state.error);
