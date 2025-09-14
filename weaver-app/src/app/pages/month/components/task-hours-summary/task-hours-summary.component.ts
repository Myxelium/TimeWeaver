import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { Task } from '../../../../shared/models';
import { map } from 'rxjs';

interface TaskChartDataPoint {
  taskTitle: string;
  totalHours: number;
  taskCount: number;
  color: string;
}

@Component({
  selector: 'app-task-hours-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-hours-summary.component.html'
})
export class TaskHoursSummaryComponent {
  readonly Math = Math; // expose for template usage
  monthlyData$ = inject(Store).select(selectMonthlyData);
  chartData$ = this.monthlyData$.pipe(
    map(days => {
      const aggregate: Record<string, { totalHours: number; taskCount: number }> = {};
      days.forEach(d => {
        (d.tasks || []).forEach((task: Task) => {
          const key = task.title.trim() || 'Untitled';
          if (!aggregate[key]) {
            aggregate[key] = { totalHours: 0, taskCount: 0 };
          }
          aggregate[key].totalHours += task.hours || 0;
          aggregate[key].taskCount += 1;
        });
      });
      const toColor = (title: string) => {
        let hash = 0;
        for (let idx = 0; idx < title.length; idx++) {
          hash = (hash * 31 + title.charCodeAt(idx)) >>> 0;
        }
        const hue = hash % 360;
        const saturation = 55 + (hash % 10);
        const lightness = 45 + (hash % 10);
        return `hsl(${hue} ${saturation}% ${lightness}%)`;
      };
      return Object.entries(aggregate)
        .map(([taskTitle, stats]) => ({
          taskTitle,
          totalHours: stats.totalHours,
          taskCount: stats.taskCount,
          color: toColor(taskTitle)
        }))
        .sort((a, b) => b.totalHours - a.totalHours);
    })
  );

  getMaxTaskHours(data: TaskChartDataPoint[]): number {
    if (!data?.length) return 1;
    return Math.max(1, Math.max(...data.map(d => d.totalHours)));
  }
}
