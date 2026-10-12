import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  HostListener,
  inject,
  Output,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  startOfMonth
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  LucideAngularModule
} from 'lucide-angular';

import { AdoSuggestionTableComponent } from '../../../../shared/ado-suggestion-table/ado-suggestion-table.component';
import { suggestionsOnDay } from '../../../../shared/ado-titles.model';
import {
  AdoSuggestion,
  CreateTaskRequest,
  DaySummary
} from '../../../../shared/models';
import { HolidayService } from '../../../../shared/services';
import { selectFirstDayOfWeek } from '../../../../store/settings/settings.selectors';
import {
  selectHolidayCountry,
  selectIgnoreWeekends,
  selectMaxHoursPerDay
} from '../../../../store/settings/settings.selectors';
import { TasksActions } from '../../../../store/tasks/tasks.actions';
import { selectAdoSuggestions, selectMonthlyData } from '../../../../store/tasks/tasks.selectors';

const REGISTER_MENU_HEIGHT = 48;
const SUGGESTED_MENU_HEIGHT = 92;
const HOUR_HUNDREDTHS = 100;
const TIP_WIDTH = 288;
const TIP_EDGE = 8;
const TIP_GAP = 8;
const TIP_HEADER = 36;
const TIP_ROW_HEIGHT = 28;
const TIP_HIDE_MS = 150;
const daysPerWeek = 7;
const saturdayIndex = 6;

function hoursUntilMax(remainingHours: number, taskCount: number): number[] {
  if (taskCount <= 0)
    return [];

  const totalHundredths = Math.max(0, Math.round(remainingHours * HOUR_HUNDREDTHS));
  const share = Math.floor(totalHundredths / taskCount);
  const leftover = totalHundredths - share * (taskCount - 1);

  return Array.from({ length: taskCount }, (_unused, index) => (index === taskCount - 1 ? leftover : share) / HOUR_HUNDREDTHS);
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: DaySummary;
  isWeekend: boolean;
  isHoliday?: boolean;
  holidayName?: string | null;
  suggestions: AdoSuggestion[];
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
  imports: [
    CommonModule,
    LucideAngularModule,
    AdoSuggestionTableComponent
  ],
  templateUrl: './monthly-overview.component.html'
})
export class MonthlyOverviewComponent {
  @Output() daySelected = new EventEmitter<Date>();
  @Output() registerRange = new EventEmitter<Date[]>();

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  currentDate = signal(new Date());

  canGoToNextMonth = true;

  calendarDays = computed<CalendarDay[]>(() => this.calculateCalendarDays());
  monthlyStats = computed(() => this.calculateMonthlyStats());

  selectedKeys = signal<string[]>([]);
  contextMenu = signal<{ x: number; y: number } | null>(null);
  suggestionTip = signal<{ x: number; y: number; suggestions: AdoSuggestion[] } | null>(null);

  private tipHideTimer: ReturnType<typeof setTimeout> | null = null;

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
  private adoSuggestionsSignal = toSignal(this.store.select(selectAdoSuggestions), { initialValue: [] as AdoSuggestion[] });
  private holidayCountrySignal = toSignal(this.store.select(selectHolidayCountry), { initialValue: undefined as string | undefined });

  private holidayService = inject(HolidayService);

  private dragAnchor: Date | null = null;
  private dragMoved = false;

  constructor() {
    const now = new Date();

    this.currentDate.set(now);
    this.store.dispatch(TasksActions.setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: now.getFullYear(), month: now.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadAdoSuggestions());
  }

  suggestionText(suggestions: AdoSuggestion[]): string {
    return suggestions
      .map(item => `${item.title} - ${item.spentTimeIsZero ? 'spent time is 0' : 'time logged'}`)
      .join('\n');
  }

  onCalendarScroll(): void {
    this.contextMenu.set(null);
    this.hideSuggestionTip();
  }

  showSuggestionTip(event: MouseEvent, suggestions: AdoSuggestion[]): void {
    this.clearTipHide();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const height = TIP_HEADER + suggestions.length * TIP_ROW_HEIGHT;
    const x = Math.max(TIP_EDGE, Math.min(rect.left, window.innerWidth - TIP_WIDTH - TIP_EDGE));
    const below = rect.bottom + TIP_GAP;
    const y = below + height > window.innerHeight - TIP_EDGE
      ? Math.max(TIP_EDGE, rect.top - height - TIP_GAP)
      : below;

    this.suggestionTip.set({ x, y, suggestions });
  }

  queueHideSuggestionTip(): void {
    this.clearTipHide();
    this.tipHideTimer = setTimeout(() => this.suggestionTip.set(null), TIP_HIDE_MS);
  }

  holdSuggestionTip(): void {
    this.clearTipHide();
  }

  hideSuggestionTip(): void {
    this.clearTipHide();
    this.suggestionTip.set(null);
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

    this.setMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const current = this.currentDate();

    this.setMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  showMonthOf(date: Date): void {
    if (isSameMonth(date, this.currentDate()))
      return;

    this.setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  isSelected(day: CalendarDay): boolean {
    return this.selectedKeys().includes(format(day.date, 'yyyy-MM-dd'));
  }

  onDayClick(day: CalendarDay): void {
    if (!day.isCurrentMonth)
      return;

    this.contextMenu.set(null);
    this.selectedKeys.set([]);
    this.daySelected.emit(day.date);
  }

  onDayPointerDown(day: CalendarDay, event: PointerEvent): void {
    if (event.button !== 0 || !day.isCurrentMonth)
      return;

    this.dragAnchor = day.date;
    this.dragMoved = false;
    event.preventDefault();
  }

  onDayPointerEnter(day: CalendarDay): void {
    if (!this.dragAnchor)
      return;

    const anchorKey = format(this.dragAnchor, 'yyyy-MM-dd');
    const dayKey = format(day.date, 'yyyy-MM-dd');

    if (dayKey !== anchorKey)
      this.dragMoved = true;

    if (this.dragMoved)
      this.selectedKeys.set(this.keysBetween(this.dragAnchor, day.date));
  }

  onDayContextMenu(day: CalendarDay, event: MouseEvent): void {
    if (!day.isCurrentMonth)
      return;

    event.preventDefault();

    const key = format(day.date, 'yyyy-MM-dd');

    if (!this.selectedKeys().includes(key))
      this.selectedKeys.set([key]);

    const menuWidth = 180;
    const menuHeight = this.selectedDaysHaveSuggestions() ? SUGGESTED_MENU_HEIGHT : REGISTER_MENU_HEIGHT;
    const x = Math.max(TIP_EDGE, Math.min(event.clientX, window.innerWidth - menuWidth - TIP_EDGE));
    const y = Math.max(TIP_EDGE, Math.min(event.clientY, window.innerHeight - menuHeight - TIP_EDGE));

    this.contextMenu.set({ x, y });
    this.hideSuggestionTip();
  }

  registerTime(): void {
    const dates = this.datesFromKeys(this.selectedKeys());

    this.contextMenu.set(null);

    if (dates.length === 0)
      return;

    if (dates.length === 1) {
      this.selectedKeys.set([]);
      this.daySelected.emit(dates[0]);
      return;
    }

    this.registerRange.emit(dates);
  }

  selectedDaysHaveSuggestions(): boolean {
    return this.suggestedTasks().length > 0;
  }

  addSuggested(): void {
    const tasks = this.suggestedTasks();

    this.contextMenu.set(null);
    this.selectedKeys.set([]);

    if (tasks.length === 0)
      return;

    this.store.dispatch(TasksActions.saveTasks({ tasks }));
  }

  @HostListener('document:pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (event.button !== 0 || !this.dragAnchor)
      return;

    const anchor = this.dragAnchor;
    const moved = this.dragMoved;

    this.dragAnchor = null;
    this.dragMoved = false;

    if (!moved) {
      setTimeout(() => {
        this.selectedKeys.set([]);
        this.daySelected.emit(anchor);
      });
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target;
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;

    if (element?.closest('.calendar-menu'))
      return;

    this.contextMenu.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.contextMenu.set(null);
    this.dragAnchor = null;
    this.dragMoved = false;
  }

  private clearTipHide(): void {
    if (this.tipHideTimer === null)
      return;

    clearTimeout(this.tipHideTimer);
    this.tipHideTimer = null;
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

        if (dow === 0 || dow === saturdayIndex)
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
    const suggestions = this.adoSuggestionsSignal();
    const current = this.currentDate();
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const calendarStart = new Date(monthStart);
    const first = this.firstDayOfWeekSignal() ?? 1;
    // shift calendarStart back to the first day-of-week boundary
    const startOffset = (monthStart.getDay() - first + daysPerWeek) % daysPerWeek;

    calendarStart.setDate(calendarStart.getDate() - startOffset);
    const calendarEnd = new Date(monthEnd);
    const weekEnd = (first + saturdayIndex) % daysPerWeek;
    const daysToAdd = (weekEnd - monthEnd.getDay() + daysPerWeek) % daysPerWeek;

    calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map(day => {
      const info = this.holidayService.getHolidayInfo(day);

      return {
        date: day,
        isCurrentMonth: isSameMonth(day, current),
        isToday: isToday(day),
        summary: this.getDaySummarySync(day),
        isWeekend: day.getDay() === 0 || day.getDay() === saturdayIndex,
        isHoliday: info.isHoliday,
        holidayName: info.name || null,
        suggestions: this.suggestionsFor(day, suggestions)
      } as CalendarDay;
    });
  }

  private setMonth(monthDate: Date): void {
    this.selectedKeys.set([]);
    this.contextMenu.set(null);
    this.currentDate.set(monthDate);
    this.store.dispatch(TasksActions.setSelectedMonth({ year: monthDate.getFullYear(), month: monthDate.getMonth() + 1 }));
    this.store.dispatch(TasksActions.loadMonthlyData({ year: monthDate.getFullYear(), month: monthDate.getMonth() + 1 }));
  }

  private keysBetween(start: Date, end: Date): string[] {
    const from = start.getTime() <= end.getTime() ? start : end;
    const to = start.getTime() <= end.getTime() ? end : start;
    const month = this.currentDate();

    return eachDayOfInterval({ start: from, end: to })
      .filter(day => isSameMonth(day, month))
      .map(day => format(day, 'yyyy-MM-dd'));
  }

  private datesFromKeys(keys: string[]): Date[] {
    return keys
      .map(key => {
        const [
          year,
          month,
          day
        ] = key.split('-').map(Number);

        return new Date(year, month - 1, day);
      })
      .sort((left, right) => left.getTime() - right.getTime());
  }

  private suggestedTasks(): CreateTaskRequest[] {
    const selected = new Set(this.selectedKeys());
    const tasks: CreateTaskRequest[] = [];

    for (const day of this.calendarDays()) {
      const date = format(day.date, 'yyyy-MM-dd');

      if (!selected.has(date))
        continue;

      const existingTitles = new Set((day.summary?.tasks ?? []).map(task => task.title.trim()));
      const existingIds = new Set((day.summary?.tasks ?? []).flatMap(task => task.adoWorkItemId == null ? [] : [task.adoWorkItemId]));
      const pending: CreateTaskRequest[] = [];

      for (const item of day.suggestions) {
        const title = item.title.trim();

        if (!title || existingTitles.has(title) || existingIds.has(item.adoId))
          continue;

        existingTitles.add(title);
        existingIds.add(item.adoId);
        pending.push({ title, date, hours: 0 });
      }

      const loggedHours = day.summary?.total_hours ?? 0;
      const remainingHours = Math.max(0, this.maxHoursPerDay - loggedHours);
      const shares = hoursUntilMax(remainingHours, pending.length);

      pending.forEach((task, index) => {
        task.hours = shares[index] ?? 0;
        tasks.push(task);
      });
    }

    return tasks;
  }

  private suggestionsFor(day: Date, suggestions: AdoSuggestion[]): AdoSuggestion[] {
    const key = format(day, 'yyyy-MM-dd');

    return suggestionsOnDay(suggestions, key);
  }
}
