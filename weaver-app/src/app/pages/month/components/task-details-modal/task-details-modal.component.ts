import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  Output
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import {
  format,
  isValid,
  parseISO
} from 'date-fns';
import {
  Calendar,
  ChevronLeft,
  Clock,
  LucideAngularModule,
  Search
} from 'lucide-angular';

import { Task } from '../../../../shared/models';
import {
  calculateTaskStatistics,
  selectError,
  selectIsLoading,
  TaskStatistics
} from '../../../../store/tasks/tasks.selectors';
import {
  EditableTask,
  TaskEntryListComponent,
  TaskMonthGroup
} from './task-entry-list/task-entry-list.component';
import { TaskStatisticsPanelComponent } from './task-statistics-panel/task-statistics-panel.component';

const yearMonthKeyLength = 7;

interface MonthOption {
  key: string;
  label: string;
}

type EntrySortOrder = 'newest' | 'oldest';

@Component({
  selector: 'app-task-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    TaskStatisticsPanelComponent,
    TaskEntryListComponent
  ],
  templateUrl: './task-details-modal.component.html'
})
export class TaskDetailsModalComponent {
  @Input() showBack = false;
  @Input() title: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() saveTask = new EventEmitter<{ id: number; title: string; description?: string; date: string; hours: number }>();

  readonly ChevronLeft = ChevronLeft;
  readonly Search = Search;
  readonly Calendar = Calendar;
  readonly Clock = Clock;

  localTasks: EditableTask[] = [];

  statistics: TaskStatistics = calculateTaskStatistics([]);

  monthOptions: MonthOption[] = [];

  searchQuery = '';
  sortOrder: EntrySortOrder = 'newest';
  selectedMonthKey: string | null = null;

  private store = inject(Store);

  loading = toSignal(this.store.select(selectIsLoading), { initialValue: false });
  loadError = toSignal(this.store.select(selectError), { initialValue: null as string | null });

  private open = false;
  private sectionsReady = false;

  private collapsedMonths = new Set<string>();

  @Input() set isOpen(value: boolean) {
    if (value && !this.open)
      this.resetFilters();

    this.open = value;
  }

  get isOpen(): boolean {
    return this.open;
  }

  @Input() set taskList(value: Task[] | null) {
    const tasks = value ?? [];
    const arriving = this.localTasks.length === 0 && tasks.length > 0;

    this.localTasks = tasks.map(task => ({ ...task, editing: false }));
    this.statistics = calculateTaskStatistics(this.localTasks);
    this.monthOptions = this.buildMonthOptions(this.localTasks);

    if (this.selectedMonthKey && !this.monthOptions.some(month => month.key === this.selectedMonthKey))
      this.selectedMonthKey = null;

    if (arriving || !this.sectionsReady) {
      this.collapseOlderMonths();
      this.sectionsReady = true;
    }
  }

  get reportingPeriod(): string {
    const start = this.statistics.dateRange.start;
    const end = this.statistics.dateRange.end;

    if (!start || !end)
      return 'No reported time';

    const startLabel = this.formatFullDate(start);
    const endLabel = this.formatFullDate(end);

    if (start === end)
      return startLabel;

    return `${startLabel} to ${endLabel}`;
  }

  get hasFilters(): boolean {
    return this.searchQuery.trim().length > 0 || this.selectedMonthKey != null;
  }

  get matchingEntryCount(): number {
    return this.filteredTasks().length;
  }

  monthGroups(): TaskMonthGroup[] {
    const groups: TaskMonthGroup[] = [];

    for (const task of this.filteredTasks()) {
      const key = this.monthKey(task.date);

      let group = groups[groups.length - 1];

      if (!group || group.key !== key) {
        group = {
          key,
          label: this.formatMonthLabel(task.date),
          entryCount: 0,
          totalHours: 0,
          tasks: [],
          expanded: !this.collapsedMonths.has(key)
        };

        groups.push(group);
      }

      group.tasks.push(task);
    }

    for (const group of groups) {
      const totalHours = group.tasks.reduce((sum, task) => sum + (task.hours || 0), 0);

      group.entryCount = group.tasks.length;
      group.totalHours = this.roundHours(totalHours);
    }

    return groups;
  }

  onClose(): void {
    this.closed.emit();
  }

  onBack(): void {
    this.back.emit();
  }

  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.sortOrder = value === 'oldest' ? 'oldest' : 'newest';
  }

  onMonthFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.selectedMonthKey = value || null;
    this.expandMonth(this.selectedMonthKey);
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedMonthKey = null;
  }

  toggleMonth(key: string): void {
    if (this.collapsedMonths.has(key))
      this.collapsedMonths.delete(key);
    else
      this.collapsedMonths.add(key);
  }

  enableEdit(task: EditableTask): void {
    task.editing = true;
  }

  cancelTaskEdit(task: EditableTask): void {
    task.editing = false;
  }

  saveTaskEdit(task: EditableTask): void {
    if (!task.id)
      return;

    this.saveTask.emit({
      id: task.id,
      title: (task.title || '').trim(),
      description: task.description || '',
      date: task.date,
      hours: Number(task.hours) || 0
    });

    task.editing = false;
  }

  private resetFilters(): void {
    this.searchQuery = '';
    this.sortOrder = 'newest';
    this.selectedMonthKey = null;
    this.collapseOlderMonths();
    this.sectionsReady = true;
  }

  private filteredTasks(): EditableTask[] {
    const tasks = this.localTasks.filter(task => task.editing || (this.matchesSearch(task) && this.matchesMonth(task)));
    const direction = this.sortOrder === 'newest' ? -1 : 1;

    return tasks.sort((left, right) => {
      const byDate = left.date.localeCompare(right.date) || (left.id ?? 0) - (right.id ?? 0);

      return byDate * direction;
    });
  }

  private matchesSearch(task: EditableTask): boolean {
    const query = this.searchQuery.trim().toLowerCase();

    if (!query)
      return true;

    const title = (task.title || '').toLowerCase();
    const description = (task.description || '').toLowerCase();

    return title.includes(query) || description.includes(query);
  }

  private matchesMonth(task: EditableTask): boolean {
    if (!this.selectedMonthKey)
      return true;

    return this.monthKey(task.date) === this.selectedMonthKey;
  }

  private expandMonth(key: string | null): void {
    if (key)
      this.collapsedMonths.delete(key);
  }

  private collapseOlderMonths(): void {
    const newest = this.monthOptions[this.monthOptions.length - 1]?.key;

    this.collapsedMonths = new Set(this.monthOptions.map(month => month.key).filter(key => key !== newest));
  }

  private buildMonthOptions(tasks: EditableTask[]): MonthOption[] {
    const keys = new Set(tasks.map(task => this.monthKey(task.date)).filter(key => key.length > 0));

    return [...keys].sort().map(key => ({
      key,
      label: this.formatMonthLabel(`${key}-01`)
    }));
  }

  private monthKey(date: string): string {
    return (date || '').substring(0, yearMonthKeyLength);
  }

  private formatMonthLabel(date: string): string {
    return this.formatEntryDate(date, 'MMMM yyyy', date || 'Unknown date');
  }

  private formatFullDate(date: string): string {
    return this.formatEntryDate(date, 'MMM d, yyyy', date);
  }

  private formatEntryDate(date: string, pattern: string, fallback: string): string {
    const parsed = parseISO(date);

    if (!isValid(parsed))
      return fallback;

    return format(parsed, pattern);
  }

  private roundHours(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
