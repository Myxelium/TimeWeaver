import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectAllTasks, selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { DaySummary, Task } from '../../../../shared/models';
import { map, take } from 'rxjs';
import { TasksActions } from '../../../../store/tasks/tasks.actions';
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
export class TaskHoursSummaryComponent {
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
  };

  calculateTaskHours(daySummary: DaySummary[]): Record<string, { totalHours: number; taskCount: number }> {
    const aggregate: Record<string, { totalHours: number; taskCount: number }> = {};

    daySummary.forEach(day => {
      (day.tasks || []).forEach((task: Task) => {
        const key = task.title.trim() || 'Untitled';

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
    this.store
      .select(selectAllTasks)
      .pipe(take(1))
      .subscribe(tasks => {
        const key = taskTitle.trim().toLowerCase();
        const matched = tasks.filter(task => (task.title || '').trim().toLowerCase() === key);

        this.detailedTasks = matched.sort((taskA, taskB) => taskA.date.localeCompare(taskB.date));
        this.showDetails = true;
      });
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
}
