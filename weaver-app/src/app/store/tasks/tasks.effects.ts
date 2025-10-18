import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { DatabaseService } from '../../shared/services/database.service';
import { TasksActions, loadAllTasks } from './tasks.actions';
import { catchError, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { selectCurrentDate, selectSelectedMonth } from './tasks.selectors';

@Injectable({ providedIn: 'root' })
export class TasksEffects {
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
    mergeMap(() => this.databaseService.getAllTasks().pipe(
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
    mergeMap(([_, currentDate, selectedMonth]) => [
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

  constructor(
    private actions$: Actions,
    private databaseService: DatabaseService,
    private store: Store
  ) {}
}
