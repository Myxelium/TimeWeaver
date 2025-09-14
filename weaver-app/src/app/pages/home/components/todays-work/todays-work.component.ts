import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Store } from '@ngrx/store';
import { selectTodayTasks, selectIsLoading } from '../../../../store/tasks/tasks.selectors';
import { TasksActions, loadAllTasks } from '../../../../store/tasks/tasks.actions';
import { Task, DAILY_WORK_HOURS } from '../../../../shared/models';
import { format, subDays } from 'date-fns';
import { combineLatest, of, Subject, Observable } from 'rxjs';
import { ConfirmService } from '../../../../shared/confirm/confirm.service';
import { map, take, startWith, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-todays-work',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './todays-work.component.html'
})
export class TodaysWorkComponent implements OnDestroy {
  // Public constants/fields
  DAILY_WORK_HOURS = DAILY_WORK_HOURS;
  currentDate = new Date();
  tasks: Task[] = []; // local cache for template iteration
  todayTasks$ = inject(Store).select(selectTodayTasks) as import('rxjs').Observable<Task[]>;
  isLoading$ = inject(Store).select(selectIsLoading) as import('rxjs').Observable<boolean>;
  taskForm: FormGroup = inject(FormBuilder).group({
    title: ['', Validators.required],
    description: [''],
    hours: [0, [Validators.min(0)]]
  });
  editingTask: Task | null = null;
  showSuggestions = false;
  showAllSuggestions = false;
  allTaskTitles: string[] = [];
  filteredSuggestions: string[] = [];
  recentSuggestions: string[] = [];
  todayTotalHours$: Observable<number> = this.todayTasks$.pipe(
    map((tasks: Task[]) => tasks.reduce((total, task) => total + task.hours, 0))
  );
  remainingHours$: Observable<number> = this.getRemainingHours();

  // Private injected/services after public fields
  private store = inject(Store);
  private destroy$ = new Subject<void>();
  private confirm = inject(ConfirmService);

  constructor() {
    const dateStr = format(this.currentDate, 'yyyy-MM-dd');
    this.store.dispatch(TasksActions.setCurrentDate({ date: dateStr }));
    this.store.dispatch(TasksActions.loadTodayTasks({ date: dateStr }));
    this.store.dispatch(loadAllTasks());
    this.loadTaskTitlesFromLast30Days();
    this.taskForm.get('title')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(val => this.filterSuggestions(val));
    this.todayTasks$.pipe(takeUntil(this.destroy$)).subscribe(tasks => (this.tasks = tasks));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.taskForm.invalid) return;
    const formValue = this.taskForm.value;
    const hours = formValue.hours || 0;
    const dateStr = format(this.currentDate, 'yyyy-MM-dd');
    if (this.editingTask) {
      this.store.dispatch(
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
      this.store.dispatch(
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
    const confirmed = await this.confirm.confirm({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?\nThis action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true
    });
    if (!confirmed) return;
    this.store.dispatch(TasksActions.deleteTask({ taskId }));
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
    combineLatest([currentTasks$, totalHours$])
      .pipe(take(1))
      .subscribe(([tasks, total]) => {
        if (!tasks.length) return;
        const remaining = DAILY_WORK_HOURS - total;
        if (remaining <= 0) return;
        const addPer = remaining / tasks.length;
        tasks.forEach(task => {
          this.store.dispatch(TasksActions.saveTask({ task: { ...task, hours: task.hours + addPer } }));
        });
      });
  }

  addEightHours(): void {
    this.getRemainingHours()
      .pipe(take(1))
      .subscribe(rem => {
        const current = this.taskForm.get('hours')?.value || 0;
        const toAdd = Math.min(8, rem);
        this.taskForm.patchValue({ hours: current + toAdd });
      });
  }

  getRemainingHours(): Observable<number> {
    const hoursValueChanges =
      this.taskForm.get('hours')?.valueChanges.pipe(
        map(value => value || 0),
        startWith(this.taskForm.get('hours')?.value || 0)
      ) || of(0);
    return combineLatest([this.todayTotalHours$, hoursValueChanges]).pipe(
      map(([totalHours, currentTaskHours]) => {
        const remainingForDay = DAILY_WORK_HOURS - totalHours;
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
    }, 200);
  }

  selectSuggestion(title: string): void {
    this.taskForm.patchValue({ title });
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  toggleAllSuggestions(): void {
    this.showAllSuggestions = !this.showAllSuggestions;
    this.filteredSuggestions = this.showAllSuggestions ? this.allTaskTitles.slice(0, 15) : this.recentSuggestions;
    this.showSuggestions = true;
  }

  trackTask(_index: number, task: Task) { return task.id ?? task.title; }

  getAddHoursLabel(rem: number): string {
    if (rem >= 8) return '+8h';
    if (rem > 0) return `+${rem.toFixed(1)}h`;
    return '0h';
  }

  remainingDayHours(total: number | null | undefined): number {
    const t = typeof total === 'number' ? total : 0;
    return Math.max(0, DAILY_WORK_HOURS - t);
  }

  progressPercent(total: number | null | undefined): number {
    const t = typeof total === 'number' ? total : 0;
    return Math.min(100, (t / DAILY_WORK_HOURS) * 100);
  }

  private resetForm(): void {
    this.taskForm.reset();
    this.taskForm.patchValue({ hours: 0 });
    this.editingTask = null;
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  private loadTaskTitlesFromLast30Days(): void {
    this.store
      .select(selectTodayTasks)
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        const thirtyDaysAgo = subDays(this.currentDate, 30);
        const recentTasks = tasks.filter(t => {
          const taskDate = new Date(t.date);
          return taskDate >= thirtyDaysAgo && taskDate <= this.currentDate;
        });
        const uniqueTitles = [...new Set(recentTasks.map(t => t.title))];
        this.allTaskTitles = uniqueTitles.reverse();
        this.recentSuggestions = this.allTaskTitles.slice(0, 5);
      });
  }

  private filterSuggestions(value: string): void {
    if (!value || value.length < 1) {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
      return;
    }
    const searchValue = value.toLowerCase();
    this.filteredSuggestions = this.allTaskTitles
      .filter(t => t.toLowerCase().includes(searchValue))
      .slice(0, 10);
    this.showSuggestions = this.filteredSuggestions.length > 0;
  }
}
