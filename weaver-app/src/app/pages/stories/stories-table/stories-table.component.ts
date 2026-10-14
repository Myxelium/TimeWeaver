import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  input,
  model,
  signal
} from '@angular/core';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Clock,
  FileText,
  LucideAngularModule,
  Search
} from 'lucide-angular';

import { AdoTitleComponent } from '../../../shared/ado-title/ado-title.component';
import { StoryYearRow } from '../story-year.model';

type SortField = 'started' | 'title' | 'ended' | 'days' | 'hours';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-stories-table',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AdoTitleComponent
  ],
  templateUrl: './stories-table.component.html',
  host: { style: 'display: block' }
})
export class StoriesTableComponent {
  readonly Search = Search;
  readonly ArrowUpDown = ArrowUpDown;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly FileText = FileText;

  rows = input<StoryYearRow[]>([]);

  searchTerm = model('');

  sortField = signal<SortField>('started');
  sortDirection = signal<SortDirection>('desc');

  sortedRows = computed(() => {
    const rows = [...this.rows()];
    const field = this.sortField();
    const direction = this.sortDirection();

    rows.sort((left, right) => {
      const comparison = compareRows(left, right, field);

      return direction === 'asc' ? comparison : -comparison;
    });

    return rows;
  });

  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.sortField.set(field);
    this.sortDirection.set(field === 'title' ? 'asc' : 'desc');
  }

  sortIcon(field: SortField): typeof ArrowUpDown | typeof ArrowUp | typeof ArrowDown {
    if (this.sortField() !== field)
      return this.ArrowUpDown;

    return this.sortDirection() === 'asc' ? this.ArrowUp : this.ArrowDown;
  }
}

function compareRows(left: StoryYearRow, right: StoryYearRow, field: SortField): number {
  switch (field) {
    case 'title':
      return left.title.localeCompare(right.title);
    case 'ended':
      return left.ended.localeCompare(right.ended);
    case 'days':
      return left.days - right.days;
    case 'hours':
      return left.hours - right.hours;
    default:
      return left.started.localeCompare(right.started);
  }
}
