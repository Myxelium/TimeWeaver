import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy
} from '@angular/core';
import { Store } from '@ngrx/store';
import {
  map,
  Subject,
  takeUntil
} from 'rxjs';

import { DaySummary, Task } from '../../../../shared/models';
import { loadAllTasks, TasksActions } from '../../../../store/tasks/tasks.actions';
import { selectAllTasks, selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { TaskDetailsModalComponent } from '../task-details-modal/task-details-modal.component';

interface TaskChartDataPoint {
  taskTitle: string;
  totalHours: number;
  taskCount: number;
  color: string;
}

@Component({
  selector: 'app-task-hours-summary',
  standalone: true,
  imports: [CommonModule, TaskDetailsModalComponent],
  templateUrl: './task-hours-summary.component.html'
})
export class TaskHoursSummaryComponent implements OnDestroy {
  Math = Math;

  monthlyData$ = inject(Store).select(selectMonthlyData);

  chartData$ = this.monthlyData$.pipe(
    map(days => {
      return Object.entries(this.calculateTaskHours(days))
        .map(([taskTitle, stats]) => ({
          taskTitle,
          totalHours: stats.totalHours,
          taskCount: stats.taskCount,
          color: this.titleToColor(taskTitle)
        }))
        .sort((itemA, itemB) => itemB.totalHours - itemA.totalHours);
    })
  );

  showDetails = false;
  selectedTaskTitle: string | null = null;

  detailedTasks: Task[] = [];

  store = inject(Store);

  private destroy$ = new Subject<void>();

  private allTasks: Task[] = [];
  private monthlyDays: DaySummary[] = [];

  constructor() {
    this.store.dispatch(loadAllTasks());

    this.store
      .select(selectAllTasks)
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        this.allTasks = tasks ?? [];
        this.syncDetailedTasks();
      });

    this.monthlyData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(days => {
        this.monthlyDays = days ?? [];
        this.syncDetailedTasks();
      });
  }

  getMaxTaskHours(data: TaskChartDataPoint[]): number {
    if (!data?.length)
      return 1;

    return Math.max(1, Math.max(...data.map(dataPoint => dataPoint.totalHours)));
  }

  titleToColor(title: string): string {
    let hash = 0;

    for (let idx = 0; idx < title.length; idx++) {
      hash = (hash * 31 + title.charCodeAt(idx)) >>> 0;
    }

    const hue = hash % 360;
    const saturation = 55 + (hash % 10);
    const lightness = 45 + (hash % 10);

    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  calculateTaskHours(daySummary: DaySummary[]): Record<string, { totalHours: number; taskCount: number }> {
    const aggregate: Record<string, { totalHours: number; taskCount: number }> = {};

    daySummary.forEach(day => {
      (day.tasks || []).forEach((task: Task) => {
        const key = this.taskKey(task.title);

        if (!aggregate[key]) {
          aggregate[key] = { totalHours: 0, taskCount: 0 };
        }

        aggregate[key].totalHours += task.hours || 0;
        aggregate[key].taskCount += 1;
      });
    });

    return aggregate;
  }

  onBarClick(taskTitle: string): void {
    this.selectedTaskTitle = taskTitle;
    this.showDetails = true;
    this.syncDetailedTasks();
    this.store.dispatch(loadAllTasks());
  }

  onModalClosed(): void {
    this.showDetails = false;
    this.selectedTaskTitle = null;
    this.detailedTasks = [];
  }

  onModalSaveTask(updated: { id: number; title: string; description?: string; date: string; hours: number }): void {
    this.store.dispatch(TasksActions.saveTask({
      task: {
        id: updated.id,
        title: (updated.title || '').trim(),
        description: updated.description || '',
        date: updated.date,
        hours: updated.hours || 0
      }
    }));
  }

  private syncDetailedTasks(): void {
    if (!this.showDetails || !this.selectedTaskTitle)
      return;

    const key = this.taskKey(this.selectedTaskTitle);
    const matched = this.mergeTasks(
      this.allTasks.filter(task => this.taskKey(task.title) === key),
      this.monthlyDays
        .flatMap(day => day.tasks || [])
        .filter(task => this.taskKey(task.title) === key)
    ).sort((taskA, taskB) => taskA.date.localeCompare(taskB.date) || (taskA.id ?? 0) - (taskB.id ?? 0));

    if (this.sameTasks(this.detailedTasks, matched))
      return;

    this.detailedTasks = matched;
  }

  private taskKey(title: string | null | undefined): string {
    return (title || '').trim() || 'Untitled';
  }

  private mergeTasks(stored: Task[], fromMonth: Task[]): Task[] {
    const byId = new Map<number, Task>();
    const withoutId: Task[] = [];

    for (const task of stored) {
      if (task.id == null) {
        withoutId.push(task);
        continue;
      }

      byId.set(task.id, task);
    }

    for (const task of fromMonth) {
      if (task.id == null) {
        withoutId.push(task);
        continue;
      }

      if (!byId.has(task.id))
        byId.set(task.id, task);
    }

    return [...byId.values(), ...withoutId];
  }

  private sameTasks(left: Task[], right: Task[]): boolean {
    if (left.length !== right.length)
      return false;

    return left.every((task, index) => {
      const other = right[index];

      return task.id === other.id
        && task.date === other.date
        && task.hours === other.hours
        && task.title === other.title
        && (task.description || '') === (other.description || '');
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
