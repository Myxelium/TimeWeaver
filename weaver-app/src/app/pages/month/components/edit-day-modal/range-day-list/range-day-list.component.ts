import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { AdoSuggestionTableComponent } from '../../../../../shared/ado-suggestion-table/ado-suggestion-table.component';
import { AdoSuggestion, Task } from '../../../../../shared/models';

export interface RangeDayRowView {
  dateKey: string;
  date: Date;
  totalHours: number;
  tasks: Task[];
  holidayName: string | null;
  suggestions: AdoSuggestion[];
  loggedIds: number[];
}

@Component({
  selector: 'app-range-day-list',
  standalone: true,
  imports: [CommonModule, AdoSuggestionTableComponent],
  templateUrl: './range-day-list.component.html'
})
export class RangeDayListComponent {
  @Input() rows: RangeDayRowView[] = [];

  @Output() addSuggestion = new EventEmitter<{ date: Date; item: AdoSuggestion }>();
}
