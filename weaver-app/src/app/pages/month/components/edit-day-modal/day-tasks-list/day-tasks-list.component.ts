import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { LucideAngularModule, Shrink } from 'lucide-angular';

import { AdoTitleComponent } from '../../../../../shared/ado-title/ado-title.component';
import { Task } from '../../../../../shared/models';

@Component({
  selector: 'app-day-tasks-list',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AdoTitleComponent
  ],
  templateUrl: './day-tasks-list.component.html'
})
export class DayTasksListComponent {
  @Input() show = true;

  @Input() tasks: Task[] = [];

  @Input() canFitToMax = false;

  @Output() edit = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<number>();
  @Output() fitToMax = new EventEmitter<void>();

  readonly Shrink = Shrink;
}
