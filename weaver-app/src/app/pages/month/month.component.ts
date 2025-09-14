import { Component, inject, OnInit, OnDestroy, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { Store } from '@ngrx/store';
import { TasksActions, loadAllTasks } from '../../store/tasks/tasks.actions';
import { selectMonthlyData, selectIsLoading, selectAllTasks } from '../../store/tasks/tasks.selectors';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, isSameDay, isSameMonth, isToday, isBefore, startOfDay } from 'date-fns';
import { Observable, map, combineLatest, Subject, take, takeUntil, debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { Task, DaySummary, DAILY_WORK_HOURS } from '../../shared/models';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: DaySummary;
}

interface ChartDataPoint {
  date: string;
  hours: number;
  tasks: string[];
}

interface TaskChartDataPoint {
  taskTitle: string;
  totalHours: number;
  taskCount: number;
  color: string;
}

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ReactiveFormsModule],
  templateUrl: './month.component.html'
})
export class MonthComponent implements OnInit, OnDestroy {
  private store = inject(Store);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  
  DAILY_WORK_HOURS = DAILY_WORK_HOURS;
  Math = Math; // Expose Math to template
  
  // Register icons
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  
  currentDate = signal(new Date());
  selectedDay = signal<Date | null>(null);
  showDayModal = signal(false);
  editingTask: Task | null = null;
  
  dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  monthlyData$ = this.store.select(selectMonthlyData);
  isLoading$ = this.store.select(selectIsLoading);
  
  taskForm: FormGroup;
  private monthlyDataCache: DaySummary[] = [];
  
  // Auto-suggestion state
  showSuggestions = false;
  showAllSuggestions = false;
  allTaskTitles: string[] = [];
  filteredSuggestions: string[] = [];
  recentSuggestions: string[] = [];
  
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
    let maxHours = 0;
    this.chartData$.pipe(take(1)).subscribe(data => {
      if (data && data.length > 0) {
        maxHours = Math.max(...data.map(d => d.totalHours));
      }
    });
    return Math.max(maxHours, 1); // Ensure minimum of 1 to avoid division by zero
  }
  
  constructor() {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      hours: [0, [Validators.min(0)]]
    });
  }
  
  get currentMonth(): Date {
    return this.currentDate();
  }
  
  chartData$ = this.monthlyData$.pipe(
    map(data => {
      return this.generateTaskChartData(data);
    })
  );
  
  ngOnInit(): void {
    const now = new Date();
    this.currentDate.set(now);
  this.store.dispatch(TasksActions.setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }));
  this.store.dispatch(TasksActions.loadMonthlyData({ year: now.getFullYear(), month: now.getMonth() + 1 }));
  this.store.dispatch(loadAllTasks());
    
    // Subscribe to monthly data to keep cache updated
    this.monthlyData$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.monthlyDataCache = data;
    });
    
    // Load task titles for auto-suggestions
    this.loadTaskTitlesFromLast30Days();

    // Set up title input monitoring for auto-suggestions
    this.taskForm.get('title')?.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(value => {
      this.filterSuggestions(value);
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.showDayModal()) {
      this.closeDayModal();
    }
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
    
    // This would be calculated from real monthly data
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const workingDays = daysInMonth.filter(day => {
      const dayOfWeek = day.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude weekends
    }).length;
    
    // Calculate from monthly data when available
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
  
  canGoToNextMonth = computed(() => {
    const current = this.currentDate();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    
    return !isBefore(currentMonthStart, next);
  });
  
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
      const selectedDate = format(this.selectedDay()!, 'yyyy-MM-dd');
      
      if (this.editingTask) {
        // Update existing task
  this.store.dispatch(TasksActions.saveTask({ task: {
          id: this.editingTask.id!,
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
  
  private generateChartData(monthlyData: DaySummary[]): ChartDataPoint[] {
    const current = this.currentDate();
    const chartData: ChartDataPoint[] = [];
    
    for (let i = 30; i >= 0; i--) {
      const date = subDays(current, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Find data for this date in monthlyData
      const dayData = monthlyData.find(d => d.date === dateStr);
      
      chartData.push({
        date: format(date, 'MMM d'),
        hours: dayData?.total_hours || 0,
        tasks: dayData?.tasks?.map(t => t.title) || []
      });
    }
    
    return chartData;
  }

  private generateTaskChartData(monthlyData: DaySummary[]): TaskChartDataPoint[] {
    // Collect all tasks from the monthly data
    const allTasks: Task[] = [];
    monthlyData.forEach(day => {
      if (day.tasks) {
        allTasks.push(...day.tasks);
      }
    });

    // Group tasks by title (case-insensitive) or by regex pattern if title contains numbers
    const taskGroups = new Map<string, { tasks: Task[], totalHours: number, displayName: string }>();
    
    allTasks.forEach(task => {
      // Check if task title starts with # followed by a number
      const numberMatch = task.title.match(/^#(\d+)(.*)$/);
      let groupKey: string;
      let displayName: string;
      
      if (numberMatch && numberMatch[1]) {
        // Task starts with #number, use the number as the display name
        const number = numberMatch[1];
        const suffix = numberMatch[2].trim();
        
        // Group by the number itself
        groupKey = number;
        displayName = `#${number}`;
      } else {
        // No #number pattern found, group by exact title
        groupKey = task.title.toLowerCase().trim();
        displayName = task.title;
      }
      
      if (!taskGroups.has(groupKey)) {
        taskGroups.set(groupKey, { tasks: [], totalHours: 0, displayName });
      }
      
      const group = taskGroups.get(groupKey)!;
      group.tasks.push(task);
      group.totalHours += task.hours;
    });

    // Generate colors for different task groups
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
      '#14b8a6', '#f43f5e', '#8b5cf6', '#0ea5e9', '#22c55e'
    ];

    // Convert to chart data points and sort by total hours (descending)
    const chartData: TaskChartDataPoint[] = Array.from(taskGroups.entries())
      .map(([groupKey, group], index) => ({
        taskTitle: group.displayName,
        totalHours: Math.round(group.totalHours * 100) / 100, // Round to 2 decimal places
        taskCount: group.tasks.length,
        color: colors[index % colors.length]
      }))
      .sort((a, b) => {
        // Sort numbers numerically, then alphabetically
        const aIsNumber = !isNaN(Number(a.taskTitle));
        const bIsNumber = !isNaN(Number(b.taskTitle));
        
        if (aIsNumber && bIsNumber) {
          return Number(a.taskTitle) - Number(b.taskTitle);
        } else if (aIsNumber && !bIsNumber) {
          return -1; // Numbers first
        } else if (!aIsNumber && bIsNumber) {
          return 1; // Numbers first
        } else {
          return b.totalHours - a.totalHours; // For non-numbers, sort by hours
        }
      })
      .slice(0, 15); // Limit to top 15 tasks to avoid overcrowding

    return chartData;
  }
  
  private loadTaskTitlesFromLast30Days(): void {
    // Get tasks from the last 30 days
  this.store.select(selectAllTasks).pipe(
      takeUntil(this.destroy$)
    ).subscribe(tasks => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      // Filter tasks from last 30 days and get unique titles
      const recentTasks = tasks.filter(task => {
        const taskDate = new Date(task.date);
        return taskDate >= thirtyDaysAgo && taskDate <= new Date();
      });
      
      // Get unique titles sorted by most recent
      const uniqueTitles = [...new Set(recentTasks.map(task => task.title))];
      this.allTaskTitles = uniqueTitles.reverse(); // Most recent first
      
      // Set the 5 most recent unique titles
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
    this.filteredSuggestions = this.allTaskTitles.filter(title =>
      title.toLowerCase().includes(searchValue)
    ).slice(0, 10); // Limit to 10 suggestions

    this.showSuggestions = this.filteredSuggestions.length > 0;
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
}
