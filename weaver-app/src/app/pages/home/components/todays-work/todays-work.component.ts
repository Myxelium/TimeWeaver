import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy,
  OnInit
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Store } from '@ngrx/store';
import { format, subDays } from 'date-fns';
import {
  combineLatest,
  Observable,
  of,
  Subject
} from 'rxjs';
import {
  map,
  startWith,
  take,
  takeUntil
} from 'rxjs/operators';

import { titlesForLogging } from '../../../../shared/ado-titles.model';
import { ConfirmService } from '../../../../shared/confirm/confirm.service';
import { AdoSuggestion, Task } from '../../../../shared/models';
import { DateChangeDetectionService } from '../../../../shared/services';
import {
  selectIgnoreWeekends,
  selectMaxHoursEnabled,
  selectMaxHoursPerDay
} from '../../../../store/settings/settings.selectors';
import { loadAllTasks, TasksActions } from '../../../../store/tasks/tasks.actions';
import {
  selectAdoSuggestions,
  selectAllTasks,
  selectIsLoading,
  selectTodayTasks
} from '../../../../store/tasks/tasks.selectors';
import { SuggestionsDropdownComponent } from '../../../month/components/edit-day-modal/suggestions-dropdown/suggestions-dropdown.component';
import { TodaysTaskListComponent } from './todays-task-list/todays-task-list.component';

const saturdayIndex = 6;
const titleBlurDelayMs = 200;
const expandedTitleCount = 15;
const recentTitleWindowDays = 30;
const collapsedTitleCount = 5;

@Component({
  selector: 'app-todays-work',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SuggestionsDropdownComponent,
    TodaysTaskListComponent
  ],
  templateUrl: './todays-work.component.html'
})
export class TodaysWorkComponent implements OnInit, OnDestroy {
  private _store = inject(Store);

  maxHoursPerDay$ = this._store.select(selectMaxHoursPerDay);
  maxHoursEnabled$ = this._store.select(selectMaxHoursEnabled);

  currentDate = new Date();

  tasks: Task[] = [];

  todayTasks$: Observable<Task[]> = this._store.select(selectTodayTasks);
  isLoading$: Observable<boolean> = this._store.select(selectIsLoading);

  editingTask: Task | null = null;
  showSuggestions = false;
  showAllSuggestions = false;

  allTaskTitles: string[] = [];
  filteredSuggestions: string[] = [];
  recentSuggestions: string[] = [];

  taskForm: FormGroup = inject(FormBuilder).group({
    title: ['', Validators.required],
    description: [''],
    hours: [0, [Validators.min(0)]]
  });

  todayTotalHours$: Observable<number> = this.todayTasks$.pipe(
    map((tasks: Task[]) => tasks.reduce((total, task) => total + task.hours, 0))
  );

  remainingHours$: Observable<number> = this.getRemainingHours();

  private destroy$ = new Subject<void>();

  private confirm = inject(ConfirmService);
  private dateChangeService = inject(DateChangeDetectionService);

  private ignoreWeekendsSignal = toSignal(inject(Store).select(selectIgnoreWeekends), { initialValue: true });

  private knownTasks: Task[] = [];
  private knownSuggestions: AdoSuggestion[] = [];

  ngOnInit(): void {
    this.initializeDate();
    this.setupSubscriptions();
    this.subscribeToDayChanges();
  }

  get weekendBlocked(): boolean {
    if (!this.ignoreWeekendsSignal())
      return false;

    const dow = this.currentDate.getDay();

    return dow === 0 || dow === saturdayIndex;
  }

  onSubmit(): void {
    if (this.taskForm.invalid || this.weekendBlocked)
      return;

    const formValue = this.taskForm.value;
    const hours = formValue.hours || 0;
    const dateStr = format(this.currentDate, 'yyyy-MM-dd');

    if (this.editingTask) {
      this._store.dispatch(
        TasksActions.saveTask({
          task: {
            id: this.editingTask.id,
            title: formValue.title,
            description: formValue.description,
            date: dateStr,
            hours
          }
        })
      );
    } else {
      this._store.dispatch(
        TasksActions.saveTask({
          task: { title: formValue.title, description: formValue.description, date: dateStr, hours }
        })
      );
    }

    this.resetForm();
  }

  editTask(task: Task): void {
    this.editingTask = task;
    this.taskForm.patchValue({ title: task.title, description: task.description || '', hours: task.hours });
    this.taskForm.markAsPristine();
  }

  cancelEdit(): void {
    this.resetForm();
  }

  async deleteTask(taskId: number): Promise<void> {
    const confirmed = await this.confirm.requestConfirmation({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?\nThis action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true
    });

    if (!confirmed)
      return;

    this._store.dispatch(TasksActions.deleteTask({ taskId }));

    if (this.editingTask && this.editingTask.id === taskId) {
      this.resetForm();
      queueMicrotask(() => document.getElementById('taskTitle')?.focus());
    }

    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  autoDistributeHours(): void {
    const currentTasks$ = this.todayTasks$.pipe(take(1));
    const totalHours$ = this.todayTotalHours$.pipe(take(1));

    combineLatest([
      currentTasks$,
      totalHours$,
      this.maxHoursPerDay$.pipe(take(1))
    ])
      .pipe(take(1))
      .subscribe(([
        tasks,
        total,
        maxHours
      ]) => {
        if (!tasks.length)
          return;

        const remaining = maxHours - total;

        if (remaining <= 0)
          return;

        const addPer = remaining / tasks.length;

        tasks.forEach(task => {
          this._store.dispatch(TasksActions.saveTask({ task: { ...task, hours: task.hours + addPer } }));
        });
      });
  }

  addEightHours(): void {
    combineLatest([this.getRemainingHours(), this.maxHoursPerDay$])
      .pipe(take(1))
      .subscribe(([remaining, maxHours]) => {
        const current = this.taskForm.get('hours')?.value || 0;
        const toAdd = Math.min(maxHours, remaining);

        this.taskForm.patchValue({ hours: current + toAdd });
      });
  }

  getRemainingHours(): Observable<number> {
    const hoursValueChanges =
      this.taskForm.get('hours')?.valueChanges.pipe(
        map(value => value || 0),
        startWith(this.taskForm.get('hours')?.value || 0)
      ) || of(0);

    return combineLatest([
      this.todayTotalHours$,
      hoursValueChanges,
      this.maxHoursPerDay$
    ]).pipe(
      map(([
        totalHours,
        currentTaskHours,
        maxHours
      ]) => {
        const remainingForDay = maxHours - totalHours;
        const editingTaskHours = this.editingTask ? this.editingTask.hours : 0;

        return Math.max(0, remainingForDay + editingTaskHours - (currentTaskHours || 0));
      })
    );
  }

  onTitleFocus(): void {
    const value = this.taskForm.get('title')?.value;

    if (value) {
      this.filterSuggestions(value);
    } else {
      this.filteredSuggestions = this.recentSuggestions;
      this.showSuggestions = this.recentSuggestions.length > 0;
    }
  }

  onTitleBlur(): void {
    setTimeout(() => {
      this.showSuggestions = false;
      this.showAllSuggestions = false;
    }, titleBlurDelayMs);
  }

  selectSuggestion(title: string): void {
    this.taskForm.patchValue({ title });
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  toggleAllSuggestions(): void {
    this.showAllSuggestions = !this.showAllSuggestions;
    this.filteredSuggestions = this.showAllSuggestions ? this.allTaskTitles.slice(0, expandedTitleCount) : this.recentSuggestions;
    this.showSuggestions = true;
  }

  trackTask(_index: number, task: Task): number | string { return task.id ?? task.title; }

  getAddHoursLabel(remaining: number): Observable<string> {
    return this.maxHoursPerDay$.pipe(
      map(maxHours => {
        if (remaining >= maxHours)
          return `+${maxHours.toFixed(1)}h`;

        if (remaining > 0)
          return `+${remaining.toFixed(1)}h`;

        return '0h';
      })
    );
  }

  remainingDayHours(total: number | null | undefined): Observable<number> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => Math.max(0, maxHours - totalHours)));
  }

  progressPercent(total: number | null | undefined): Observable<number> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => {
      if (maxHours === 0)
        return 0;

      if (totalHours <= maxHours)
        return (totalHours / maxHours) * 100;

      return (maxHours / totalHours) * 100;
    }));
  }

  overtimePercent(total: number | null | undefined): Observable<number> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => {
      if (maxHours === 0 || totalHours <= maxHours)
        return 0;

      const overtimeHours = totalHours - maxHours;

      return (overtimeHours / totalHours) * 100;
    }));
  }

  hasOvertime(total: number | null | undefined): Observable<boolean> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => totalHours > maxHours));
  }

  private initializeDate(): void {
    this.currentDate = this.dateChangeService.currentDate;

    const dateStr = this.dateChangeService.currentDateString;

    this._store.dispatch(TasksActions.setCurrentDate({ date: dateStr }));
    this._store.dispatch(TasksActions.loadTodayTasks({ date: dateStr }));
    this._store.dispatch(loadAllTasks());
  }

  private setupSubscriptions(): void {
    this.loadTaskTitlesFromLast30Days();
    this.taskForm.get('title')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(val => this.filterSuggestions(val));
    this.todayTasks$.pipe(takeUntil(this.destroy$)).subscribe(tasks => (this.tasks = tasks));

    this.applyWeekendBlockState();
    this._store
      .select(selectIgnoreWeekends)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyWeekendBlockState());
  }

  private subscribeToDayChanges(): void {
    this.dateChangeService.currentDate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentDate = this.dateChangeService.currentDate;

        const dateStr = this.dateChangeService.currentDateString;

        this._store.dispatch(TasksActions.setCurrentDate({ date: dateStr }));
        this._store.dispatch(TasksActions.loadTodayTasks({ date: dateStr }));
        this._store.dispatch(loadAllTasks());

        this.resetForm();
        this.rebuildTitles();
        this.applyWeekendBlockState();
      });
  }

  private resetForm(): void {
    this.taskForm.reset();
    this.taskForm.patchValue({ hours: 0 });
    this.editingTask = null;
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  private loadTaskTitlesFromLast30Days(): void {
    combineLatest([this._store.select(selectAllTasks), this._store.select(selectAdoSuggestions)])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([tasks, suggestions]) => {
        this.knownTasks = tasks;
        this.knownSuggestions = suggestions;
        this.rebuildTitles();
      });
  }

  private rebuildTitles(): void {
    const thirtyDaysAgo = subDays(this.currentDate, recentTitleWindowDays);
    const recentTasks = this.knownTasks.filter(task => {
      const taskDate = new Date(task.date);

      return taskDate >= thirtyDaysAgo && taskDate <= this.currentDate;
    });
    const taskTitles = [...new Set(recentTasks.map(task => task.title))].reverse();

    this.allTaskTitles = titlesForLogging(taskTitles, this.knownSuggestions);
    this.recentSuggestions = this.allTaskTitles.slice(0, collapsedTitleCount);
  }

  private filterSuggestions(value: string): void {
    if (!value || value.length < 1) {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
      return;
    }

    const searchValue = value.toLowerCase();

    this.filteredSuggestions = this.allTaskTitles
      .filter(task => task.toLowerCase().includes(searchValue))
      .slice(0, 10);

    this.showSuggestions = this.filteredSuggestions.length > 0;
  }

  private applyWeekendBlockState(): void {
    if (this.weekendBlocked) {
      if (!this.taskForm.disabled)
        this.taskForm.disable({ emitEvent: false });
    } else {
      if (this.taskForm.disabled)
        this.taskForm.enable({ emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
