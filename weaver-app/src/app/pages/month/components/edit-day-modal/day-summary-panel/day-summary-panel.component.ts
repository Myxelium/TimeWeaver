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
}
