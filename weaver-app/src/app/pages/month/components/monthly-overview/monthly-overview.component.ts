import {
  Component,
  EventEmitter,
  Output,
  computed,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  ChevronLeft,
  ChevronRight
} from 'lucide-angular';
import { Store } from '@ngrx/store';
import { TasksActions } from '../../../../store/tasks/tasks.actions';
import { selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { selectFirstDayOfWeek } from '../../../../store/settings/settings.selectors';
import {
  selectHolidayCountry,
  selectIgnoreWeekends,
  selectMaxHoursPerDay
} from '../../../../store/settings/settings.selectors';
import { DaySummary } from '../../../../shared/models';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday
} from 'date-fns';
import { toSignal } from '@angular/core/rxjs-interop';
import { HolidayService } from '../../../../shared/services';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: DaySummary;
  isWeekend: boolean;
  isHoliday?: boolean;
  holidayName?: string | null;
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

  currentDate = signal(new Date());
  canGoToNextMonth = true;
  calendarDays = computed<CalendarDay[]>(() => this.calculateCalendarDays());
  monthlyStats = computed(() => this.calculateMonthlyStats());

  private store = inject(Store);

  private readonly baseHeaders = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat'
  ] as const;

  private firstDayOfWeekSignal = toSignal(this.store.select(selectFirstDayOfWeek), { initialValue: 1 });

  private ignoreWeekendsSignal = toSignal(this.store.select(selectIgnoreWeekends), { initialValue: true });

  private maxHoursPerDaySignal = toSignal(this.store.select(selectMaxHoursPerDay), { initialValue: 8 });

  private monthlyDataSignal = toSignal(this.store.select(selectMonthlyData), { initialValue: [] as DaySummary[] });

  private holidayCountrySignal = toSignal(this.store.select(selectHolidayCountry), { initialValue: undefined as string | undefined });

  private holidayService = inject(HolidayService);

  constructor() {
    const now = new Date();

    this.currentDate.set(now);
    this.store.dispatch(TasksActions.setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: now.getFullYear(), month: now.getMonth() + 1 }));
  }

  get dayHeaders(): string[] {
    const first = this.firstDayOfWeekSignal() ?? 1;
    const headers = [...this.baseHeaders];

    return headers.slice(first).concat(headers.slice(0, first));
  }

  get monthlyData(): DaySummary[] { return this.monthlyDataSignal(); }

  get ignoreWeekends(): boolean { return this.ignoreWeekendsSignal(); }

  get maxHoursPerDay(): number { return this.maxHoursPerDaySignal(); }

  getBaseProgressWidth(totalHours: number): number {
    if (this.maxHoursPerDay === 0)
      return 0;

    if (totalHours <= this.maxHoursPerDay)
      return (totalHours / this.maxHoursPerDay) * 100;

    return (this.maxHoursPerDay / totalHours) * 100;
  }

  getOvertimeWidth(totalHours: number): number {
    if (this.maxHoursPerDay === 0 || totalHours <= this.maxHoursPerDay)
      return 0;

    const overtimeHours = totalHours - this.maxHoursPerDay;

    return (overtimeHours / totalHours) * 100;
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

    this.currentDate.set(next);
    this.store.dispatch(TasksActions.setSelectedMonth({ year: next.getFullYear(), month: next.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: next.getFullYear(), month: next.getMonth() + 1 }));
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
    const expectedHours = workingDays * this.maxHoursPerDay;
    const completionRate = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;

    return {
      totalHours,
      workingDays,
      averageHours,
      completionRate
    };
  }

  private calculateCalendarDays(): CalendarDay[] {
    // read to register reactive dependency on holiday country changes
    void this.holidayCountrySignal();
    const current = this.currentDate();
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const calendarStart = new Date(monthStart);
    const first = this.firstDayOfWeekSignal() ?? 1;
    // shift calendarStart back to the first day-of-week boundary
    const startOffset = (monthStart.getDay() - first + 7) % 7;

    calendarStart.setDate(calendarStart.getDate() - startOffset);
    const calendarEnd = new Date(monthEnd);
    const weekEnd = (first + 6) % 7;
    const daysToAdd = (weekEnd - monthEnd.getDay() + 7) % 7;

    calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map(day => {
      const info = this.holidayService.getHolidayInfo(day);

      return {
        date: day,
        isCurrentMonth: isSameMonth(day, current),
        isToday: isToday(day),
        summary: this.getDaySummarySync(day),
        isWeekend: day.getDay() === 0 || day.getDay() === 6,
        isHoliday: info.isHoliday,
        holidayName: info.name || null
      } as CalendarDay;
    });
  }
}
