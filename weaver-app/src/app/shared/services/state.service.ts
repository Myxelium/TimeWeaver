import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, EMPTY } from 'rxjs';
import { switchMap, catchError, tap, map } from 'rxjs/operators';
import { format } from 'date-fns';
import { DatabaseService } from './database.service';
import { Task, DaySummary, AppState, CreateTaskRequest, UpdateTaskRequest } from '../models';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly initialState: AppState = {
    currentDate: format(new Date(), 'yyyy-MM-dd'),
    selectedMonth: { 
      year: new Date().getFullYear(), 
      month: new Date().getMonth() + 1 
    },
    todayTasks: [],
    monthlyData: [],
    allTasks: [],
    monthlySummary: 0,
    isLoading: false,
    error: null
  };

  private state$ = new BehaviorSubject<AppState>(this.initialState);
  
  // Action subjects
  private loadTodayTasks$ = new BehaviorSubject<string>(this.initialState.currentDate);
  private loadMonthlyData$ = new BehaviorSubject<{year: number, month: number}>(this.initialState.selectedMonth);
  private loadAllTasks$ = new BehaviorSubject<boolean>(true);
  private saveTask$ = new BehaviorSubject<CreateTaskRequest | UpdateTaskRequest | null>(null);
  private deleteTask$ = new BehaviorSubject<number | null>(null);
  private exportCsv$ = new BehaviorSubject<{year: number, month: number} | null>(null);

  constructor(private databaseService: DatabaseService) {
    this.setupEffects();
  }

  // Public state selectors
  getState(): Observable<AppState> {
    return this.state$.asObservable();
  }

  getCurrentDate(): Observable<string> {
    return this.state$.pipe(map(state => state.currentDate));
  }

  getTodayTasks(): Observable<Task[]> {
    return this.state$.pipe(map(state => state.todayTasks));
  }

  getMonthlyData(): Observable<DaySummary[]> {
    return this.state$.pipe(map(state => state.monthlyData));
  }

  getAllTasks(): Observable<Task[]> {
    return this.state$.pipe(map(state => state.allTasks));
  }

  getMonthlySummary(): Observable<number> {
    return this.state$.pipe(map(state => state.monthlySummary));
  }

  getSelectedMonth(): Observable<{year: number, month: number}> {
    return this.state$.pipe(map(state => state.selectedMonth));
  }

  isLoading(): Observable<boolean> {
    return this.state$.pipe(map(state => state.isLoading));
  }

  getError(): Observable<string | null> {
    return this.state$.pipe(map(state => state.error));
  }

  // Public actions
  setCurrentDate(date: string): void {
    this.updateState({ currentDate: date });
    this.loadTodayTasks$.next(date);
  }

  setSelectedMonth(year: number, month: number): void {
    const selectedMonth = { year, month };
    this.updateState({ selectedMonth });
    this.loadMonthlyData$.next(selectedMonth);
  }

  refreshTodayTasks(): void {
    this.loadTodayTasks$.next(this.state$.value.currentDate);
  }

  refreshMonthlyData(): void {
    this.loadMonthlyData$.next(this.state$.value.selectedMonth);
  }

  refreshAllTasks(): void {
    this.loadAllTasks$.next(true);
  }

  saveTask(task: CreateTaskRequest | UpdateTaskRequest): void {
    this.saveTask$.next(task);
  }

  deleteTask(taskId: number): void {
    this.deleteTask$.next(taskId);
  }

  exportCsv(year: number, month: number): void {
    this.exportCsv$.next({ year, month });
  }

  // Private methods
  private setupEffects(): void {
    // Load today's tasks effect
    this.loadTodayTasks$.pipe(
      switchMap(date => {
        this.setLoading(true);
        return this.databaseService.getTasksByDate(date).pipe(
          tap(tasks => {
            this.updateState({ todayTasks: tasks, isLoading: false, error: null });
          }),
          catchError(error => {
            this.updateState({ isLoading: false, error: error.message });
            return EMPTY;
          })
        );
      })
    ).subscribe();

    // Load monthly data effect
    this.loadMonthlyData$.pipe(
      switchMap(({ year, month }) => {
        this.setLoading(true);
        return combineLatest([
          this.databaseService.getTasksByMonth(year, month),
          this.databaseService.getMonthlySummary(year, month)
        ]).pipe(
          tap(([monthlyData, monthlySummary]) => {
            this.updateState({ 
              monthlyData, 
              monthlySummary, 
              isLoading: false, 
              error: null 
            });
          }),
          catchError(error => {
            this.updateState({ isLoading: false, error: error.message });
            return EMPTY;
          })
        );
      })
    ).subscribe();

    // Load all tasks effect
    this.loadAllTasks$.pipe(
      switchMap(() => {
        this.setLoading(true);
        return this.databaseService.getAllTasks().pipe(
          tap(allTasks => {
            this.updateState({ allTasks, isLoading: false, error: null });
          }),
          catchError(error => {
            this.updateState({ isLoading: false, error: error.message });
            return EMPTY;
          })
        );
      })
    ).subscribe();

    // Save task effect
    this.saveTask$.pipe(
      switchMap(task => {
        if (!task) return EMPTY;
        
        this.setLoading(true);
        return this.databaseService.saveTask(task).pipe(
          tap(() => {
            // Refresh relevant data after save
            this.refreshTodayTasks();
            this.refreshMonthlyData();
            this.refreshAllTasks();
          }),
          catchError(error => {
            this.updateState({ isLoading: false, error: error.message });
            return EMPTY;
          })
        );
      })
    ).subscribe();

    // Delete task effect
    this.deleteTask$.pipe(
      switchMap(taskId => {
        if (!taskId) return EMPTY;
        
        this.setLoading(true);
        return this.databaseService.deleteTask(taskId).pipe(
          tap(() => {
            // Refresh relevant data after delete
            this.refreshTodayTasks();
            this.refreshMonthlyData();
            this.refreshAllTasks();
          }),
          catchError(error => {
            this.updateState({ isLoading: false, error: error.message });
            return EMPTY;
          })
        );
      })
    ).subscribe();

    // Export CSV effect
    this.exportCsv$.pipe(
      switchMap(params => {
        if (!params) return EMPTY;
        
        this.setLoading(true);
        return this.databaseService.exportCsv(params.year, params.month).pipe(
          tap(success => {
            this.updateState({ 
              isLoading: false, 
              error: success ? null : 'Export failed' 
            });
          }),
          catchError(error => {
            this.updateState({ isLoading: false, error: error.message });
            return EMPTY;
          })
        );
      })
    ).subscribe();

    // Initialize data
    this.loadTodayTasks$.next(this.initialState.currentDate);
    this.loadMonthlyData$.next(this.initialState.selectedMonth);
    this.loadAllTasks$.next(true);
  }

  private updateState(partialState: Partial<AppState>): void {
    this.state$.next({
      ...this.state$.value,
      ...partialState
    });
  }

  private setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }
}
