import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-day-summary-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './day-summary-panel.component.html'
})
export class DaySummaryPanelComponent {
  @Input() show = true;
  @Input() totalHours = 0;
  @Input() taskCount = 0;
  @Input() maxHoursPerDay$!: Observable<number>;

  getBaseProgressWidth(maxHours: number): number {
    if (maxHours === 0)
      return 0;

    // If no overtime, show normal progress
    if (this.totalHours <= maxHours)
      return (this.totalHours / maxHours) * 100;

    // With overtime: show base hours as proportion of total
    const baseHours = maxHours;

    return (baseHours / this.totalHours) * 100;
  }

  getOvertimeWidth(maxHours: number): number {
    if (maxHours === 0 || this.totalHours <= maxHours)
      return 0;

    // Overtime hours as proportion of total hours
    const overtimeHours = this.totalHours - maxHours;

    return (overtimeHours / this.totalHours) * 100;
  }
}
