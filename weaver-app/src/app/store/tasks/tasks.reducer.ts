import { createReducer, on } from '@ngrx/store';

import { loadAllTasks, TasksActions } from './tasks.actions';
import { initialTasksState } from './tasks.state';

export const tasksFeatureKey = 'tasks';

/* eslint-disable junolint/decompose-complex-expressions */
export const tasksReducer = createReducer(
  initialTasksState,
  on(TasksActions.setCurrentDate, (state, { date }) => ({ ...state, currentDate: date })),
  on(TasksActions.setSelectedMonth, (state, { year, month }) => ({ ...state, selectedMonth: { year, month } })),

  on(TasksActions.loadTodayTasks, (state) => ({ ...state, isLoading: true })),
  on(TasksActions.loadTodayTasksSuccess, (state, { tasks }) => ({ ...state, todayTasks: tasks, isLoading: false, error: null })),
  on(TasksActions.loadTodayTasksFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(TasksActions.loadMonthlyData, (state) => ({ ...state, isLoading: true })),
  on(
    TasksActions.loadMonthlyDataSuccess,
    (state, { monthlyData, monthlySummary }) => ({
      ...state,
      monthlyData,
      monthlySummary,
      isLoading: false,
      error: null
    })
  ),
  on(TasksActions.loadMonthlyDataFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(loadAllTasks, (state) => ({ ...state, isLoading: true })),
  on(TasksActions.loadAllTasksSuccess, (state, { tasks }) => ({ ...state, allTasks: tasks, isLoading: false, error: null })),
  on(TasksActions.loadAllTasksFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(TasksActions.loadAdoSuggestionsSuccess, (state, { suggestions }) => ({ ...state, adoSuggestions: suggestions })),

  on(TasksActions.saveTask, (state) => ({ ...state, isLoading: true })),
  on(TasksActions.saveTaskSuccess, (state) => ({ ...state, isLoading: false })),
  on(TasksActions.saveTaskFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(TasksActions.saveTasks, (state) => ({ ...state, isLoading: true })),
  on(TasksActions.saveTasksSuccess, (state) => ({ ...state, isLoading: false })),
  on(TasksActions.saveTasksFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(TasksActions.deleteTask, (state) => ({ ...state, isLoading: true })),
  on(TasksActions.deleteTaskSuccess, (state) => ({ ...state, isLoading: false })),
  on(TasksActions.deleteTaskFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(TasksActions.exportCsv, (state) => ({ ...state, isLoading: true })),
  on(TasksActions.exportCsvSuccess, (state) => ({ ...state, isLoading: false })),
  on(TasksActions.exportCsvFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(TasksActions.exportCsvAll, (state) => ({ ...state, isLoading: true })),
  on(TasksActions.exportCsvAllSuccess, (state) => ({ ...state, isLoading: false })),
  on(TasksActions.exportCsvAllFailure, (state, { error }) => ({ ...state, isLoading: false, error }))
);
/* eslint-enable junolint/decompose-complex-expressions */
