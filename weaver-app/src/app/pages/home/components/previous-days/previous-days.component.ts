import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { Task, DAILY_WORK_HOURS } from '../../../../shared/models';
import { format, subDays } from 'date-fns';
import { map } from 'rxjs';

@Component({
  selector: 'app-previous-days',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './previous-days.component.html'
})
export class PreviousDaysComponent {
  DAILY_WORK_HOURS = DAILY_WORK_HOURS;
  currentDate = signal(new Date());
  previousDays$ = inject(Store)
    .select(selectMonthlyData)
    .pipe(
      map(monthlyData => {
        const days: { date: Date; tasks: Task[]; totalHours: number }[] = [];
        for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
          const date = subDays(this.currentDate(), dayIndex);
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayData = monthlyData.find(d => d.date === dateStr);
          days.push({
            date,
            tasks: dayData?.tasks || [],
            totalHours: dayData?.total_hours || 0
          });
        }
        return days;
      })
    );
}
