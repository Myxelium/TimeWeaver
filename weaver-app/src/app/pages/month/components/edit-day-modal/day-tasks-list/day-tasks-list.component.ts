import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { Task } from '../../../../../shared/models';

@Component({
  selector: 'app-day-tasks-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './day-tasks-list.component.html'
})
export class DayTasksListComponent {
  @Input() show = true;

  @Input() tasks: Task[] = [];

  @Output() edit = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<number>();
}
