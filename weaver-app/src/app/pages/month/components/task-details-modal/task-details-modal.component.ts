import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Task } from '../../../../shared/models';
import { selectMaxHoursPerDay } from '../../../../store/settings/settings.selectors';
import { LucideAngularModule, Clock, Calendar, TrendingUp, BarChart3 } from 'lucide-angular';

type EditableTask = Task & { editing?: boolean };

interface TaskStatistics {
  totalHours: number;
  totalItems: number;
  calculatedDays: number;
  averageHoursPerDay: number;
  dateRange: { start: string | null; end: string | null };
}

@Component({
  selector: 'app-task-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './task-details-modal.component.html'
})
export class TaskDetailsModalComponent {
  @Input() isOpen = false;
  @Input() title: string | null = null;
  @Input() set tasks(value: Task[] | null) {
    const arr = value ?? [];

    this._currentTasks = arr;
    this.localTasks = arr.map(task => ({ ...task, editing: false }));
    this.statistics = this._calculateStatistics(arr, this._maxHoursPerDay);
    this.visibleCount = Math.min(15, arr.length);
  }

  @Output() closed = new EventEmitter<void>();
  @Output() saveTask = new EventEmitter<{ id: number; title: string; description?: string; date: string; hours: number }>();

  // Lucide icons
  readonly Clock = Clock;
  readonly Calendar = Calendar;
  readonly TrendingUp = TrendingUp;
  readonly BarChart3 = BarChart3;

  localTasks: EditableTask[] = [];
  statistics: TaskStatistics = this._calculateStatistics([], 8);
  visibleCount = 15;

  private _store = inject(Store);
  private _maxHoursPerDay = 8;
  private _currentTasks: Task[] = [];

  constructor() {
    this._store.select(selectMaxHoursPerDay).subscribe(maxHours => {
      this._maxHoursPerDay = maxHours;
      this.statistics = this._calculateStatistics(this._currentTasks, maxHours);
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  enableEdit(index: number): void {
    this.localTasks[index].editing = true;
  }

  cancel(index: number): void {
    const task = this.localTasks[index];

    if (!task)
      return;

    // revert editing state only; parent owns truth, so next open will re-clone
    task.editing = false;
  }

  save(index: number): void {
    const task = this.localTasks[index];

    if (!task || !task.id)
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

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const threshold = 100;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;

    if (atBottom && this.visibleCount < this.localTasks.length) {
      this.loadMore();
    }
  }

  loadMore(): void {
    this.visibleCount = Math.min(this.visibleCount + 15, this.localTasks.length);
  }

  getMonthKey(date: string): string {
    return date.substring(0, 7); // YYYY-MM
  }

  formatMonthLabel(date: string): string {
    const dateObj = new Date(date + 'T00:00:00');

    return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  isNewMonth(index: number): boolean {
    if (index === 0)
      return true;

    const currentTask = this.localTasks[index];
    const prevTask = this.localTasks[index - 1];

    return this.getMonthKey(currentTask.date) !== this.getMonthKey(prevTask.date);
  }

  private _calculateStatistics(tasks: Task[], maxHoursPerDay: number): TaskStatistics {
    if (!tasks || tasks.length === 0) {
      return {
        totalHours: 0,
        totalItems: 0,
        calculatedDays: 0,
        averageHoursPerDay: 0,
        dateRange: { start: null, end: null }
      };
    }

    const totalHours = tasks.reduce((sum, task) => sum + (task.hours || 0), 0);
    const uniqueDates = new Set(tasks.map(task => task.date));
    const sortedDates = Array.from(uniqueDates).sort();
    const calculatedDays = maxHoursPerDay > 0 ? totalHours / maxHoursPerDay : 0;

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalItems: tasks.length,
      calculatedDays: Math.round(calculatedDays * 100) / 100,
      averageHoursPerDay: uniqueDates.size > 0 ? Math.round((totalHours / uniqueDates.size) * 100) / 100 : 0,
      dateRange: {
        start: sortedDates[0] || null,
        end: sortedDates[sortedDates.length - 1] || null
      }
    };
  }
}
