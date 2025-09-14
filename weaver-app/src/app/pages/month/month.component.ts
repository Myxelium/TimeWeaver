import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  computed,
  signal,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { Store } from '@ngrx/store';
import { TasksActions, loadAllTasks } from '../../store/tasks/tasks.actions';
import {
  selectMonthlyData,
  selectIsLoading,
  selectAllTasks
} from '../../store/tasks/tasks.selectors';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subDays,
  isSameMonth,
  isToday,
  isBefore
} from 'date-fns';
import { Subject, take, takeUntil, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { Task, DaySummary, DAILY_WORK_HOURS } from '../../shared/models';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: DaySummary;
}

interface TaskChartDataPoint {
  taskTitle: string;
  totalHours: number;
  taskCount: number;
  color: string;
}

// (Removed unused ChartDataPoint / TaskChartDataPoint interfaces per lint)

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ReactiveFormsModule],
  templateUrl: './month.component.html'
})
export class MonthComponent implements OnInit, OnDestroy {
  DAILY_WORK_HOURS = DAILY_WORK_HOURS;
  Math = Math;

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  currentDate = signal(new Date());
  selectedDay = signal<Date | null>(null);
  showDayModal = signal(false);
  editingTask: Task | null = null;

  dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  monthlyData$ = inject(Store).select(selectMonthlyData);
  isLoading$ = inject(Store).select(selectIsLoading);

  taskForm: FormGroup;
  showSuggestions = false;
  showAllSuggestions = false;
  allTaskTitles: string[] = [];
  filteredSuggestions: string[] = [];
  recentSuggestions: string[] = [];

  canGoToNextMonth = computed(() => {
    const current = this.currentDate();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    return !isBefore(currentMonthStart, next);
  });

  chartData$ = this.monthlyData$.pipe(
    map(days => {
      // Flatten tasks by title aggregating hours
      const aggregate: Record<string, { totalHours: number; taskCount: number }> = {};
      days.forEach(d => {
        (d.tasks || []).forEach(task => {
          const key = task.title.trim() || 'Untitled';
          if (!aggregate[key]) {
            aggregate[key] = { totalHours: 0, taskCount: 0 };
          }
          aggregate[key].totalHours += task.hours || 0;
          aggregate[key].taskCount += 1;
        });
      });
      // Deterministic color generation from title
      const toColor = (title: string) => {
        let hash = 0;
        for (let idx = 0; idx < title.length; idx++) {
          hash = (hash * 31 + title.charCodeAt(idx)) >>> 0;
        }
        const hue = hash % 360;
        const saturation = 55 + (hash % 10); // 55-64
        const lightness = 45 + (hash % 10); // 45-54
        return `hsl(${hue} ${saturation}% ${lightness}%)`;
      };
      const result: TaskChartDataPoint[] = Object.entries(aggregate)
        .map(([taskTitle, stats]) => ({
          taskTitle,
          totalHours: stats.totalHours,
          taskCount: stats.taskCount,
          color: toColor(taskTitle)
        }))
        .sort((a, b) => b.totalHours - a.totalHours);
      return result;
    })
  );

  calendarDays = computed(() => {
    const current = this.currentDate();
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);

    // Get the first day of the calendar (might be from previous month)
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - monthStart.getDay());

    // Get the last day of the calendar (might be from next month)
    const calendarEnd = new Date(monthEnd);
    const daysToAdd = 6 - monthEnd.getDay();
    calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map(day => ({
      date: day,
      isCurrentMonth: isSameMonth(day, current),
      isToday: isToday(day),
      summary: this.getDaySummarySync(day)
    }));
  });

  monthlyStats = computed(() => {
    const current = this.currentDate();
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);

    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const workingDays = daysInMonth.filter(day => {
      const dayOfWeek = day.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude weekends
    }).length;

    let totalHours = 0;
    let daysWithTasks = 0;

    daysInMonth.forEach(day => {
      const summary = this.getDaySummarySync(day);
      if (summary && summary.total_hours > 0) {
        totalHours += summary.total_hours;
        daysWithTasks++;
      }
    });

    const averageHours = daysWithTasks > 0 ? totalHours / daysWithTasks : 0;
    const expectedHours = workingDays * DAILY_WORK_HOURS;
    const completionRate = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;

    return {
      totalHours,
      workingDays,
      averageHours,
      completionRate
    };
  });

  private store = inject(Store);
  private destroy$ = new Subject<void>();
  private monthlyDataCache: DaySummary[] = [];

  constructor() {
    this.taskForm = inject(FormBuilder).group({
      title: ['', Validators.required],
      description: [''],
      hours: [0, [Validators.min(0)]]
    });
  }

  get currentMonth(): Date {
    return this.currentDate();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(_event: KeyboardEvent): void {
    if (this.showDayModal()) {
      this.closeDayModal();
    }
  }

  getDayTotalHours(): number {
    const day = this.selectedDay();
    if (!day) return 0;

    const dateStr = format(day, 'yyyy-MM-dd');

    // Try to get from cache first
    let summary = this.monthlyDataCache.find(d => d.date === dateStr);

    // If not in cache, try to get it synchronously from the observable
    if (!summary) {
      this.monthlyData$.pipe(take(1)).subscribe(data => {
        summary = data.find(d => d.date === dateStr);
      });
    }

    return summary?.total_hours || 0;
  }

  getDayTaskCount(): number {
    const day = this.selectedDay();
    if (!day) return 0;

    const dateStr = format(day, 'yyyy-MM-dd');

    // Try to get from cache first
    let summary = this.monthlyDataCache.find(d => d.date === dateStr);

    // If not in cache, try to get it synchronously from the observable
    if (!summary) {
      this.monthlyData$.pipe(take(1)).subscribe(data => {
        summary = data.find(d => d.date === dateStr);
      });
    }

    return summary?.task_count || 0;
  }

  getDayTasks(): Task[] {
    const day = this.selectedDay();
    if (!day) return [];

    const dateStr = format(day, 'yyyy-MM-dd');

    // Use cached data for synchronous access
    const summary = this.monthlyDataCache.find(d => d.date === dateStr);
    return summary?.tasks || [];
  }

  getMaxTaskHours(): number {
    // Scale bars relative to the largest aggregated task total (not the largest day total)
    let maxHours = 0;
    this.chartData$.pipe(take(1)).subscribe(data => {
      if (data && data.length > 0) {
        maxHours = Math.max(...data.map(d => d.totalHours));
      }
    });
    return Math.max(maxHours, 1); // Avoid division by zero
  }

  // (Constructor moved above per ordering rule)

  ngOnInit(): void {
    const now = new Date();
    this.currentDate.set(now);
    this.store.dispatch(TasksActions.setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: now.getFullYear(), month: now.getMonth() + 1 }));
    this.store.dispatch(loadAllTasks());

    // Subscribe to monthly data to keep cache updated
    this.monthlyData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.monthlyDataCache = data;
      });

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

  previousMonth(): void {
    const current = this.currentDate();
    const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);

    // Don't allow going to future months beyond current month
    const now = new Date();
    const currentMonthStart = startOfMonth(now);

    if (!isBefore(previous, currentMonthStart)) {
      this.currentDate.set(previous);
      this.store.dispatch(TasksActions.setSelectedMonth({ year: previous.getFullYear(), month: previous.getMonth() + 1 }));
      this.store.dispatch(TasksActions.loadMonthlyData({ year: previous.getFullYear(), month: previous.getMonth() + 1 }));
    }
  }

  nextMonth(): void {
    const current = this.currentDate();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);

    // Don't allow going beyond current month
    const now = new Date();
    const currentMonthStart = startOfMonth(now);

    if (!isBefore(currentMonthStart, next)) {
      this.currentDate.set(next);
      this.store.dispatch(TasksActions.setSelectedMonth({ year: next.getFullYear(), month: next.getMonth() + 1 }));
      this.store.dispatch(TasksActions.loadMonthlyData({ year: next.getFullYear(), month: next.getMonth() + 1 }));
    }
  }

  onDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      this.selectedDay.set(day.date);
      this.showDayModal.set(true);
    }
  }

  closeDayModal(): void {
    this.showDayModal.set(false);
    this.selectedDay.set(null);
  }

  onSubmit(): void {
    if (this.taskForm.valid && this.selectedDay()) {
      const formValue = this.taskForm.value;
      const hours = formValue.hours || 0;
      const selectedDate = format(this.selectedDay() as Date, 'yyyy-MM-dd');

      if (this.editingTask) {
        // Update existing task
        this.store.dispatch(TasksActions.saveTask({ task: {
          id: this.editingTask.id,
          title: formValue.title,
          description: formValue.description,
          date: selectedDate,
          hours: hours
        }}));
      } else {
        this.store.dispatch(TasksActions.saveTask({ task: {
          title: formValue.title,
          description: formValue.description,
          date: selectedDate,
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
      description: task.description,
      hours: task.hours
    });
  }

  deleteTask(taskId: number): void {
    if (confirm('Are you sure you want to delete this task?')) {
      this.store.dispatch(TasksActions.deleteTask({ taskId }));
    }
  }

  addRemainingHours(): void {
    const currentDayHours = this.getDayTotalHours();
    const remainingHours = Math.max(0, DAILY_WORK_HOURS - currentDayHours);
    const currentFormHours = this.taskForm.get('hours')?.value || 0;
    this.taskForm.patchValue({ hours: currentFormHours + remainingHours });
  }

  resetForm(): void {
    this.taskForm.reset();
    this.taskForm.patchValue({ hours: 0 });
    this.editingTask = null;
  }

  // Private helpers moved to bottom for ordering compliance

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

  // ===== Private Helpers =====

  private getDaySummary(date: Date): DaySummary | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');
    let found: DaySummary | undefined;
    this.monthlyData$.pipe(take(1)).subscribe((data: DaySummary[]) => {
      found = data.find((d: DaySummary) => d.date === dateStr);
    });
    return found;
  }

  private getDaySummarySync(date: Date): DaySummary | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');
    return this.monthlyDataCache.find(d => d.date === dateStr);
  }

  private loadTaskTitlesFromLast30Days(): void {
    this.store
      .select(selectAllTasks)
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        const thirtyDaysAgo = subDays(new Date(), 30);
        const recentTasks = tasks.filter(task => {
          const taskDate = new Date(task.date);
          return taskDate >= thirtyDaysAgo && taskDate <= new Date();
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
