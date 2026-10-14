import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { AdoTitleComponent } from '../../../../../shared/ado-title/ado-title.component';
import { Task } from '../../../../../shared/models';

@Component({
  selector: 'app-day-tasks-list',
  standalone: true,
  imports: [CommonModule, AdoTitleComponent],
  templateUrl: './day-tasks-list.component.html'
})
export class DayTasksListComponent {
  @Input() show = true;

  @Input() tasks: Task[] = [];

  @Output() edit = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<number>();
}
