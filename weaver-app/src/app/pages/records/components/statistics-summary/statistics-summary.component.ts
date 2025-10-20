import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectTaskStatistics } from '../../../../store/tasks/tasks.selectors';
import { LucideAngularModule, Clock, Calendar, TrendingUp, BarChart3 } from 'lucide-angular';

@Component({
  selector: 'app-statistics-summary',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './statistics-summary.component.html'
})
export class StatisticsSummaryComponent {
  // Lucide icons
  readonly Clock = Clock;
  readonly Calendar = Calendar;
  readonly TrendingUp = TrendingUp;
  readonly BarChart3 = BarChart3;

  statistics$ = this._store.select(selectTaskStatistics);

  constructor(private _store: Store) {}
}
