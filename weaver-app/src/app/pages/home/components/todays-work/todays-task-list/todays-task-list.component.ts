import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AdoTitleComponent } from '../../../../../shared/ado-title/ado-title.component';
import { Task } from '../../../../../shared/models';

@Component({
  selector: 'app-todays-task-list',
  standalone: true,
  imports: [CommonModule, AdoTitleComponent],
  templateUrl: './todays-task-list.component.html'
})
export class TodaysTaskListComponent {
  @Input() tasks: Task[] = [];

  @Input() todayTotalHours$!: Observable<number>;
  @Input() maxHoursPerDay$!: Observable<number>;
  @Input() maxHoursEnabled$!: Observable<boolean>;

  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<number>();
  @Output() autoDistribute = new EventEmitter<void>();

  remainingDayHours(total: number | null | undefined): Observable<number> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => Math.max(0, maxHours - totalHours)));
  }

  progressPercent(total: number | null | undefined): Observable<number> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => {
      if (maxHours === 0)
        return 0;

      if (totalHours <= maxHours)
        return (totalHours / maxHours) * 100;

      return (maxHours / totalHours) * 100;
    }));
  }

  overtimePercent(total: number | null | undefined): Observable<number> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => {
      if (maxHours === 0 || totalHours <= maxHours)
        return 0;

      const overtimeHours = totalHours - maxHours;

      return (overtimeHours / totalHours) * 100;
    }));
  }

  hasOvertime(total: number | null | undefined): Observable<boolean> {
    const totalHours = typeof total === 'number' ? total : 0;

    return this.maxHoursPerDay$.pipe(map(maxHours => totalHours > maxHours));
  }
}
