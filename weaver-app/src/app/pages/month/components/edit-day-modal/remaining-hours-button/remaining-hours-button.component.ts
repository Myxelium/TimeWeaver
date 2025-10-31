import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-remaining-hours-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './remaining-hours-button.component.html'
})
export class RemainingHoursButtonComponent {
  @Input() show = true;
  @Input() maxHoursPerDay = 0;
  @Input() dayTotalHours = 0;

  @Output() addRemaining = new EventEmitter<void>();
}
