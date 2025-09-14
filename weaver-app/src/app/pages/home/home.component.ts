import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { map, takeUntil, debounceTime, distinctUntilChanged, take, startWith } from 'rxjs/operators';
import { format, subDays } from 'date-fns';
import { Store } from '@ngrx/store';
import { TasksActions, loadAllTasks } from '../../store/tasks/tasks.actions';
import { selectTodayTasks, selectIsLoading, selectMonthlyData } from '../../store/tasks/tasks.selectors';
import { Task, DAILY_WORK_HOURS } from '../../shared/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  DAILY_WORK_HOURS = DAILY_WORK_HOURS;
  currentDate = new Date();
  todayTasks$ = inject(Store).select(selectTodayTasks);
  isLoading$ = inject(Store).select(selectIsLoading);
  taskForm: FormGroup;
  editingTask: Task | null = null;
  showSuggestions = false;
  showAllSuggestions = false;
  allTaskTitles: string[] = [];
  filteredSuggestions: string[] = [];
  recentSuggestions: string[] = [];
  previousDays$: Observable<{ date: Date; tasks: Task[]; totalHours: number }[]>;
  todayTotalHours$: Observable<number>;
  private store = inject(Store);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  constructor() {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      hours: [0, [Validators.min(0)]]
    });

    // Calculate today's total hours from tasks
    this.todayTotalHours$ = this.todayTasks$.pipe(
      map(tasks => tasks.reduce((total, task) => total + task.hours, 0))
    );

    // Load previous days data from state service
    this.previousDays$ = this.store.select(selectMonthlyData).pipe(
      map(monthlyData => {
        const days: { date: Date; tasks: Task[]; totalHours: number }[] = [];

        // Get last 7 days excluding today
        for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
          const date = subDays(this.currentDate, dayIndex);
          const dateStr = format(date, 'yyyy-MM-dd');

          const dayData = monthlyData.find(day => day.date === dateStr);
          days.push({
            date,
            tasks: dayData?.tasks || [],
            totalHours: dayData?.total_hours || 0
          });
        }

        return days;
      })
    );
  }

  ngOnInit(): void {
    // Set current date for today's tasks
    const dateStr = format(this.currentDate, 'yyyy-MM-dd');
    this.store.dispatch(TasksActions.setCurrentDate({ date: dateStr }));
    this.store.dispatch(TasksActions.loadTodayTasks({ date: dateStr }));
    this.store.dispatch(TasksActions.setSelectedMonth({ year: this.currentDate.getFullYear(), month: this.currentDate.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: this.currentDate.getFullYear(), month: this.currentDate.getMonth() + 1 }));
    this.store.dispatch(loadAllTasks());

    // Load task titles for auto-suggestions
    this.loadTaskTitlesFromLast30Days();

    // Set up title input monitoring for auto-suggestions
    this.taskForm.get('title')?.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.filterSuggestions(value);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.taskForm.valid) {
      const formValue = this.taskForm.value;
      const hours = formValue.hours || 0; // Default to 0 if no hours specified

      if (this.editingTask) {
        // Update existing task
        this.store.dispatch(TasksActions.saveTask({ task: {
          id: this.editingTask.id,
          title: formValue.title,
          description: formValue.description,
          date: format(this.currentDate, 'yyyy-MM-dd'),
          hours: hours
        }}));
      } else {
        this.store.dispatch(TasksActions.saveTask({ task: {
          title: formValue.title,
          description: formValue.description,
          date: format(this.currentDate, 'yyyy-MM-dd'),
          hours: hours
        }}));
      }

      this.resetForm();
    }
  }

  editTask(task: Task): void {
    this.editingTask = task;
    this.taskForm.patchValue({
      title: task.title,
      description: task.description || '',
      hours: task.hours
    });
    // Mark form as pristine after patching to prevent immediate validation errors
    this.taskForm.markAsPristine();
  }

  cancelEdit(): void {
    this.resetForm();
  }

  deleteTask(taskId: number): void {
    if (confirm('Are you sure you want to delete this task?')) {
      this.store.dispatch(TasksActions.deleteTask({ taskId }));
    }
  }

  autoDistributeHours(): void {
    // Get current snapshot of tasks and total hours (not reactive)
    const currentTasks = this.todayTasks$.pipe(take(1));
    const currentTotalHours = this.todayTotalHours$.pipe(take(1));

    combineLatest([currentTasks, currentTotalHours])
      .pipe(take(1)) // Only take one emission to prevent infinite loop
      .subscribe(([tasks, totalHours]) => {
        if (tasks.length === 0) return;

        const remainingHours = DAILY_WORK_HOURS - totalHours;
        if (remainingHours <= 0) return;

        const hoursPerTask = remainingHours / tasks.length;

        // Update each task with additional hours
        tasks.forEach(task => {
          const updatedTask = {
            ...task,
            hours: task.hours + hoursPerTask
          };
          this.store.dispatch(TasksActions.saveTask({ task: updatedTask }));
        });
      });
  }

  onTitleFocus(): void {
    if (this.taskForm.get('title')?.value) {
      this.filterSuggestions(this.taskForm.get('title')?.value);
    } else {
      // Show recent suggestions when focused with no value
      this.filteredSuggestions = this.recentSuggestions;
      this.showSuggestions = this.recentSuggestions.length > 0;
    }
  }

  onTitleBlur(): void {
    // Delay hiding to allow clicking on suggestions
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
    if (this.showAllSuggestions) {
      this.filteredSuggestions = this.allTaskTitles.slice(0, 15); // Show more when expanded
    } else {
      this.filteredSuggestions = this.recentSuggestions;
    }
    this.showSuggestions = true;
  }

  addEightHours(): void {
    this.getRemainingHours().pipe(take(1))
      .subscribe(remainingHours => {
        const currentHours = this.taskForm.get('hours')?.value || 0;
        const hoursToAdd = Math.min(8, remainingHours);
        this.taskForm.patchValue({ hours: currentHours + hoursToAdd });
      });
  }

  getRemainingHours(): Observable<number> {
    const hoursValueChanges = this.taskForm.get('hours')?.valueChanges.pipe(
      map(value => value || 0),
      startWith(this.taskForm.get('hours')?.value || 0)
    ) || of(0);

    return combineLatest([
      this.todayTotalHours$,
      hoursValueChanges
    ]).pipe(
      map(([totalHours, currentTaskHours]) => {
        const remainingForDay = DAILY_WORK_HOURS - totalHours;
        const editingTaskHours = this.editingTask ? this.editingTask.hours : 0;
        return Math.max(0, remainingForDay + editingTaskHours - (currentTaskHours || 0));
      })
    );
  }

  private resetForm(): void {
    this.taskForm.reset();
    this.taskForm.patchValue({ hours: 0 });
    this.editingTask = null;
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  private loadTaskTitlesFromLast30Days(): void {
    this.store.select(selectTodayTasks)
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        const thirtyDaysAgo = subDays(this.currentDate, 30);
        const recentTasks = tasks.filter(task => {
          const taskDate = new Date(task.date);
          return taskDate >= thirtyDaysAgo && taskDate <= this.currentDate;
        });
        const uniqueTitles = [...new Set(recentTasks.map(task => task.title))];
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
      .filter(title => title.toLowerCase().includes(searchValue))
      .slice(0, 10);
    this.showSuggestions = this.filteredSuggestions.length > 0;
  }
}
