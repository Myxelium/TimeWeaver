import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  format,
  isValid,
  parseISO
} from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  LucideAngularModule,
  Pencil
} from 'lucide-angular';

import { Task } from '../../../../../shared/models';

export type EditableTask = Task & { editing?: boolean };

export interface TaskMonthGroup {
  key: string;
  label: string;
  entryCount: number;
  totalHours: number;
  tasks: EditableTask[];
  expanded: boolean;
}

@Component({
  selector: 'app-task-entry-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule
  ],
  templateUrl: './task-entry-list.component.html'
})
export class TaskEntryListComponent {
  @Input() groups: TaskMonthGroup[] = [];

  @Output() enableEdit = new EventEmitter<EditableTask>();
  @Output() saveTask = new EventEmitter<EditableTask>();
  @Output() cancelEdit = new EventEmitter<EditableTask>();
  @Output() toggleMonth = new EventEmitter<string>();

  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;
  readonly Clock = Clock;
  readonly Pencil = Pencil;

  dayNumber(date: string): string {
    return this.formatPart(date, 'dd', '--');
  }

  monthLabel(date: string): string {
    return this.formatPart(date, 'MMM', '');
  }

  entryMeta(task: EditableTask): string {
    const weekday = this.formatPart(task.date, 'EEE', '');
    const description = task.description?.trim() || 'No description';

    if (!weekday)
      return description;

    return `${weekday} · ${description}`;
  }

  fullDate(date: string): string {
    return this.formatPart(date, 'MMM d, yyyy', date);
  }

  private formatPart(date: string, pattern: string, fallback: string): string {
    const parsed = parseISO(date);

    if (!isValid(parsed))
      return fallback;

    return format(parsed, pattern);
  }
}
