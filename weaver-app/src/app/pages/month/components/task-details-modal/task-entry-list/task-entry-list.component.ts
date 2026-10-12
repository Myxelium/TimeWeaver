import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Task } from '../../../../../shared/models';

const yearMonthKeyLength = 7;

type EditableTask = Task & { editing?: boolean };

@Component({
  selector: 'app-task-entry-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-entry-list.component.html'
})
export class TaskEntryListComponent {
  @Input() tasks: EditableTask[] = [];

  @Output() enableEdit = new EventEmitter<number>();
  @Output() saveTask = new EventEmitter<number>();
  @Output() cancelEdit = new EventEmitter<number>();

  formatMonthLabel(date: string): string {
    const dateObj = new Date(date + 'T00:00:00');

    return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  isNewMonth(index: number): boolean {
    if (index === 0)
      return true;

    const currentTask = this.tasks[index];
    const previousTask = this.tasks[index - 1];

    return this.monthKey(currentTask.date) !== this.monthKey(previousTask.date);
  }

  private monthKey(date: string): string {
    return date.substring(0, yearMonthKeyLength);
  }
}
