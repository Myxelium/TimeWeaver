import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { AdoTitleComponent } from '../../../../../shared/ado-title/ado-title.component';
import { AdoSuggestion, DaySummary } from '../../../../../shared/models';

export interface CalendarDayView {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: DaySummary;
  isHoliday?: boolean;
  suggestions: AdoSuggestion[];
}

@Component({
  selector: 'app-calendar-day-cell',
  standalone: true,
  imports: [CommonModule, AdoTitleComponent],
  templateUrl: './calendar-day-cell.component.html'
})
export class CalendarDayCellComponent {
  @Input({ required: true }) day!: CalendarDayView;

  @Input() maxHoursPerDay = 0;

  @Output() suggestionEnter = new EventEmitter<{ event: MouseEvent; suggestions: AdoSuggestion[] }>();
  @Output() suggestionLeave = new EventEmitter<void>();

  suggestionText(suggestions: AdoSuggestion[]): string {
    return suggestions
      .map(item => `${item.title} - ${item.spentTimeIsZero ? 'spent time is 0' : 'time logged'}`)
      .join('\n');
  }

  getBaseProgressWidth(totalHours: number): number {
    if (this.maxHoursPerDay === 0)
      return 0;

    if (totalHours <= this.maxHoursPerDay)
      return (totalHours / this.maxHoursPerDay) * 100;

    return (this.maxHoursPerDay / totalHours) * 100;
  }

  getOvertimeWidth(totalHours: number): number {
    if (this.maxHoursPerDay === 0 || totalHours <= this.maxHoursPerDay)
      return 0;

    const overtimeHours = totalHours - this.maxHoursPerDay;

    return (overtimeHours / totalHours) * 100;
  }

  showTip(event: MouseEvent): void {
    this.suggestionEnter.emit({ event, suggestions: this.day.suggestions });
  }
}
