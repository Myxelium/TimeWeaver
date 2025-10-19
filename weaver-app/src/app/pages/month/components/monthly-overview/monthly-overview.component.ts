import { Component, EventEmitter, Output, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { Store } from '@ngrx/store';
import { TasksActions } from '../../../../store/tasks/tasks.actions';
import { selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { selectIgnoreWeekends } from '../../../../store/settings/settings.selectors';
import { DaySummary, DAILY_WORK_HOURS } from '../../../../shared/models';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore } from 'date-fns';
import { toSignal } from '@angular/core/rxjs-interop';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: DaySummary;
  isWeekend: boolean;
}

interface MonthlyStats {
  totalHours: number;
  workingDays: number;
  averageHours: number;
  completionRate: number;
};

@Component({
  selector: 'app-monthly-overview',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './monthly-overview.component.html'
})
export class MonthlyOverviewComponent {
  @Output() daySelected = new EventEmitter<Date>();

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  DAILY_WORK_HOURS = DAILY_WORK_HOURS;
  dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  currentDate = signal(new Date());

  canGoToNextMonth = computed(() => this.calculateCanGoToNextMonth());
  calendarDays = computed<CalendarDay[]>(() => this.calculateCalendarDays());
  monthlyStats = computed(() => this.calculateMonthlyStats());

  private store = inject(Store);
  private ignoreWeekendsSignal = toSignal(this.store.select(selectIgnoreWeekends), { initialValue: true });
  private monthlyDataSignal = toSignal(this.store.select(selectMonthlyData), { initialValue: [] as DaySummary[] });
  get monthlyData(): DaySummary[] { return this.monthlyDataSignal(); }
  get ignoreWeekends(): boolean { return this.ignoreWeekendsSignal(); }

  constructor() {
    const now = new Date();

    this.currentDate.set(now);
    this.store.dispatch(TasksActions.setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: now.getFullYear(), month: now.getMonth() + 1 }));
  }

  previousMonth(): void {
    const current = this.currentDate();
    const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);

    this.currentDate.set(previous);
    this.store.dispatch(TasksActions.setSelectedMonth({ year: previous.getFullYear(), month: previous.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: previous.getFullYear(), month: previous.getMonth() + 1 }));
  }

  nextMonth(): void {
    const current = this.currentDate();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);

    if (!isBefore(currentMonthStart, next)) {
      this.currentDate.set(next);
      this.store.dispatch(TasksActions.setSelectedMonth({ year: next.getFullYear(), month: next.getMonth() + 1 }));
      this.store.dispatch(TasksActions.loadMonthlyData({ year: next.getFullYear(), month: next.getMonth() + 1 }));
    }
  }

  onDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth)
      this.daySelected.emit(day.date);
  }

  private getDaySummarySync(date: Date): DaySummary | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');

    return this.monthlyData.find((daySummary: DaySummary) => daySummary.date === dateStr);
  }

  private calculateMonthlyStats(): MonthlyStats {
    const current = this.currentDate();
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const ignoreWeekends = this.ignoreWeekendsSignal();
    const workingDays = daysInMonth.filter(day => {
      if (ignoreWeekends) {
        const dow = day.getDay();

        if (dow === 0 || dow === 6)
          return false;
      }

      return true;
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
  }

  private calculateCalendarDays(): CalendarDay[] {
    const current = this.currentDate();
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const calendarStart = new Date(monthStart);

    calendarStart.setDate(calendarStart.getDate() - monthStart.getDay());
    const calendarEnd = new Date(monthEnd);
    const daysToAdd = 6 - monthEnd.getDay();

    calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map(day => ({
      date: day,
      isCurrentMonth: isSameMonth(day, current),
      isToday: isToday(day),
      summary: this.getDaySummarySync(day),
      isWeekend: day.getDay() === 0 || day.getDay() === 6
    }));
  }

  private calculateCanGoToNextMonth(): boolean {
    const current = this.currentDate();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);

    return !isBefore(currentMonthStart, next);
  }
}
