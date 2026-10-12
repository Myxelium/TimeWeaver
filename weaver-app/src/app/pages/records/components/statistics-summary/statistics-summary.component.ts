import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  input
} from '@angular/core';
import {
  BarChart3,
  Calendar,
  Clock,
  LucideAngularModule,
  TrendingUp
} from 'lucide-angular';

import { Task } from '../../../../shared/models';
import { calculateTaskStatistics } from '../../../../store/tasks/tasks.selectors';

@Component({
  selector: 'app-statistics-summary',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './statistics-summary.component.html'
})
export class StatisticsSummaryComponent {
  readonly Clock = Clock;
  readonly Calendar = Calendar;
  readonly TrendingUp = TrendingUp;
  readonly BarChart3 = BarChart3;

  tasks = input<Task[]>([]);

  statistics = computed(() => calculateTaskStatistics(this.tasks()));
}
