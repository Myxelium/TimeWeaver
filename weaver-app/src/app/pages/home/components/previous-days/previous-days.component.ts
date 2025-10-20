import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../../../shared/models';
import { format, subDays } from 'date-fns';
import { DatabaseService } from '../../../../shared/services/database.service';
import { Store } from '@ngrx/store';
import { selectMaxHoursPerDay } from '../../../../store/settings/settings.selectors';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-previous-days',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './previous-days.component.html'
})
export class PreviousDaysComponent {
  maxHoursPerDay = toSignal(inject(Store).select(selectMaxHoursPerDay), { initialValue: 8 });
  currentDate = signal(new Date());
  previousDays = signal<{
    date: Date; tasks: Task[]; totalHours: number;
  }[]>([]);
  private databaseService = inject(DatabaseService);

  constructor() {
    this.loadLastSevenDays();
  }

  private loadLastSevenDays(): void {
    const now = this.currentDate();
    const tasksPromises: Promise<void>[] = [];
    const collected: { date: Date; tasks: Task[]; totalHours: number }[] = [];

    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const date = subDays(now, dayOffset);
      const dateStr = format(date, 'yyyy-MM-dd');
      const taskPromise = this.databaseService.getTasksByDate(dateStr)
        .toPromise()
        .then(tasks => {
          const safeTasks: Task[] = Array.isArray(tasks) ? tasks : [];
          const total = safeTasks.reduce((acc, task) => acc + (task.hours || 0), 0);

          collected.push({ date, tasks: safeTasks, totalHours: total });
        });

      tasksPromises.push(taskPromise);
    }

    Promise.all(tasksPromises).then(() => {
      collected.sort((left, right) => right.date.getTime() - left.date.getTime());
      this.previousDays.set(collected);
    });
  }
}
