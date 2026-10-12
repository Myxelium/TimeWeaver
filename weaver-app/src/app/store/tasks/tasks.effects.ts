import { inject, Injectable } from '@angular/core';
import {
  Actions,
  createEffect,
  ofType
} from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  map,
  mergeMap,
  of,
  switchMap,
  withLatestFrom
} from 'rxjs';

import { DatabaseService } from '../../shared/services/database.service';
import { loadAllTasks, TasksActions } from './tasks.actions';
import { selectCurrentDate, selectSelectedMonth } from './tasks.selectors';

@Injectable({ providedIn: 'root' })
export class TasksEffects {
  private actions$ = inject(Actions);
  private databaseService = inject(DatabaseService);
  private store = inject(Store);

  readonly loadToday$ = createEffect(() => this.actions$.pipe(
    ofType(TasksActions.loadTodayTasks),
    mergeMap(({ date }) => this.databaseService.getTasksByDate(date).pipe(
      map(tasks => TasksActions.loadTodayTasksSuccess({ tasks })),
      catchError(err => of(TasksActions.loadTodayTasksFailure({ error: err.message || 'Load today tasks failed' })))
    ))
  ));

  readonly loadMonthly$ = createEffect(() => this.actions$.pipe(
    ofType(TasksActions.loadMonthlyData),
    mergeMap(({ year, month }) => this.databaseService.getTasksByMonth(year, month).pipe(
      mergeMap(monthlyData => this.databaseService.getMonthlySummary(year, month).pipe(
        map(monthlySummary => TasksActions.loadMonthlyDataSuccess({ monthlyData, monthlySummary }))
      )),
      catchError(err => of(TasksActions.loadMonthlyDataFailure({ error: err.message || 'Load monthly data failed' })))
    ))
  ));

  readonly loadAll$ = createEffect(() => this.actions$.pipe(
    ofType(loadAllTasks),
    switchMap(() => this.databaseService.getAllTasks().pipe(
      map(tasks => TasksActions.loadAllTasksSuccess({ tasks })),
      catchError(err => of(TasksActions.loadAllTasksFailure({ error: err.message || 'Load all tasks failed' })))
    ))
  ));

  readonly saveTask$ = createEffect(() => this.actions$.pipe(
    ofType(TasksActions.saveTask),
    mergeMap(({ task }) => this.databaseService.saveTask(task).pipe(
      map(taskId => TasksActions.saveTaskSuccess({ taskId })),
      catchError(err => of(TasksActions.saveTaskFailure({ error: err.message || 'Save task failed' })))
    ))
  ));

  readonly afterMutationRefresh$ = createEffect(() => this.actions$.pipe(
    ofType(TasksActions.saveTaskSuccess, TasksActions.deleteTaskSuccess),
    withLatestFrom(
      this.store.select(selectCurrentDate),
      this.store.select(selectSelectedMonth)
    ),
    mergeMap(([
      _,
      currentDate,
      selectedMonth
    ]) => [
      TasksActions.loadTodayTasks({ date: currentDate }),
      TasksActions.loadMonthlyData({ year: selectedMonth.year, month: selectedMonth.month }),
      loadAllTasks()
    ])
  ));

  readonly deleteTask$ = createEffect(() => this.actions$.pipe(
    ofType(TasksActions.deleteTask),
    mergeMap(({ taskId }) => this.databaseService.deleteTask(taskId).pipe(
      map(() => TasksActions.deleteTaskSuccess({ taskId })),
      catchError(err => of(TasksActions.deleteTaskFailure({ error: err.message || 'Delete task failed' })))
    ))
  ));

  readonly exportCsv$ = createEffect(() => this.actions$.pipe(
    ofType(TasksActions.exportCsv),
    mergeMap(({ year, month }) => this.databaseService.exportCsv(year, month).pipe(
      map(success => success ? TasksActions.exportCsvSuccess({ success }) : TasksActions.exportCsvFailure({ error: 'Export failed' })),
      catchError(err => of(TasksActions.exportCsvFailure({ error: err.message || 'Export failed' })))
    ))
  ));

  readonly exportCsvAll$ = createEffect(() => this.actions$.pipe(
    ofType(TasksActions.exportCsvAll),
    mergeMap(() => this.databaseService.exportAllCsv().pipe(
      map(success => success ? TasksActions.exportCsvAllSuccess({ success }) : TasksActions.exportCsvAllFailure({ error: 'Export failed' })),
      catchError(err => of(TasksActions.exportCsvAllFailure({ error: err.message || 'Export failed' })))
    ))
  ));
}
