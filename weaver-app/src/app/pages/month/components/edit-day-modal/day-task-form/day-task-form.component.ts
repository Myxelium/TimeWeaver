import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { Task } from '../../../../../shared/models';
import { RemainingHoursButtonComponent } from '../remaining-hours-button/remaining-hours-button.component';
import { SuggestionsDropdownComponent } from '../suggestions-dropdown/suggestions-dropdown.component';

@Component({
  selector: 'app-day-task-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SuggestionsDropdownComponent,
    RemainingHoursButtonComponent
  ],
  templateUrl: './day-task-form.component.html'
})
export class DayTaskFormComponent {
  @Input() isRangeMode = false;
  @Input() editingTask: Task | null = null;
  @Input() allowDateChange = false;
  @Input() singleTaskMode = false;
  @Input() showSuggestions = false;
  @Input() showAllSuggestions = false;

  @Input() recentSuggestions: string[] = [];
  @Input() filteredSuggestions: string[] = [];
  @Input() allTaskTitles: string[] = [];

  @Input() dayTotalHours = 0;

  @Input({ required: true }) taskForm!: FormGroup;
  @Input() isLoading$!: Observable<boolean>;
  @Input() maxHoursEnabled$!: Observable<boolean>;
  @Input() maxHoursPerDay$!: Observable<number>;

  @Output() submitForm = new EventEmitter<void>();
  @Output() titleFocus = new EventEmitter<void>();
  @Output() titleBlur = new EventEmitter<void>();
  @Output() toggleAll = new EventEmitter<void>();
  @Output() selectSuggestion = new EventEmitter<string>();
  @Output() addRemaining = new EventEmitter<void>();
  @Output() cancelEdit = new EventEmitter<void>();

  remainingHoursVisible(maxHours: number | null): boolean {
    if (this.isRangeMode || this.singleTaskMode || !maxHours)
      return false;

    return maxHours - this.dayTotalHours > 0;
  }
}
