import {
  createAction,
  createActionGroup,
  emptyProps,
  props
} from '@ngrx/store';

import {
  AdoSuggestion,
  CreateTaskRequest,
  DaySummary,
  Task,
  UpdateTaskRequest
} from '../../shared/models';

export const TasksActions = createActionGroup({
  source: 'Tasks',
  events: {
    'Set Current Date': props<{ date: string }>(),
    'Set Selected Month': props<{ year: number; month: number }>(),

    'Load Today Tasks': props<{ date: string }>(),
    'Load Today Tasks Success': props<{ tasks: Task[] }>(),
    'Load Today Tasks Failure': props<{ error: string }>(),

    'Load Monthly Data': props<{ year: number; month: number }>(),
    'Load Monthly Data Success': props<{ monthlyData: DaySummary[]; monthlySummary: number }>(),
    'Load Monthly Data Failure': props<{ error: string }>(),

    'Load All Tasks Success': props<{ tasks: Task[] }>(),
    'Load All Tasks Failure': props<{ error: string }>(),

    'Load Ado Suggestions': emptyProps(),
    'Load Ado Suggestions Success': props<{ suggestions: AdoSuggestion[] }>(),

    'Save Task': props<{ task: CreateTaskRequest | UpdateTaskRequest }>(),
    'Save Task Success': props<{ taskId: number }>(),
    'Save Task Failure': props<{ error: string }>(),

    'Save Tasks': props<{ tasks: CreateTaskRequest[] }>(),
    'Save Tasks Success': emptyProps(),
    'Save Tasks Failure': props<{ error: string }>(),

    'Delete Task': props<{ taskId: number }>(),
    'Delete Task Success': props<{ taskId: number }>(),
    'Delete Task Failure': props<{ error: string }>(),

    'Export Csv': props<{ year: number; month: number }>(),
    'Export Csv Success': props<{ success: boolean }>(),
    'Export Csv Failure': props<{ error: string }>(),

    'Export Csv All': emptyProps(),
    'Export Csv All Success': props<{ success: boolean }>(),
    'Export Csv All Failure': props<{ error: string }>()
  }
});

export const loadAllTasks = createAction('[Tasks] Load All Tasks');
