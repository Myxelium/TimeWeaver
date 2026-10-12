import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  model,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Clock,
  FileText,
  LucideAngularModule,
  Search
} from 'lucide-angular';

import { DaySummary, Task } from '../../../../shared/models';
import { TasksActions } from '../../../../store/tasks/tasks.actions';
import { selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { EditDayModalComponent } from '../../../month/components/edit-day-modal/edit-day-modal.component';

type SortField = 'date' | 'title' | 'hours';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-tasks-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    EditDayModalComponent
  ],
  templateUrl: './tasks-table.component.html'
})
export class TasksTableComponent {
  // Lucide icons
  readonly Search = Search;
  readonly ArrowUpDown = ArrowUpDown;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly FileText = FileText;
  readonly AlignLeft = AlignLeft;

  tasks = input<Task[]>([]);

  searchTerm = model('');

  sortField = signal<SortField>('date');
  sortDirection = signal<SortDirection>('desc');
  showEditModal = signal(false);
  selectedTask = signal<Task | null>(null);

  filteredAndSortedTasks = computed(() => {
    const tasks = [...this.tasks()];
    const field = this.sortField();
    const direction = this.sortDirection();

    tasks.sort((taskA, taskB) => {
      let comparison = 0;

      switch (field) {
        case 'date':
          comparison = taskA.date.localeCompare(taskB.date);
          break;
        case 'title':
          comparison = taskA.title.localeCompare(taskB.title);
          break;
        case 'hours':
          comparison = (taskA.hours || 0) - (taskB.hours || 0);
          break;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return tasks;
  });

  private _store = inject(Store);

  private monthlyData = toSignal(this._store.select(selectMonthlyData), { initialValue: [] });

  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: SortField): typeof ArrowUpDown | typeof ArrowUp | typeof ArrowDown {
    if (this.sortField() !== field) {
      return this.ArrowUpDown;
    }

    return this.sortDirection() === 'asc' ? this.ArrowUp : this.ArrowDown;
  }

  trackByTaskId(_index: number, task: Task): number | undefined {
    return task.id;
  }

  openEditModal(task: Task): void {
    this.selectedTask.set(task);

    const taskDate = new Date(task.date);
    const year = taskDate.getFullYear();
    const month = taskDate.getMonth() + 1;

    this._store.dispatch(TasksActions.loadMonthlyData({ year, month }));

    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.selectedTask.set(null);
  }

  getSelectedDate(): Date | null {
    const task = this.selectedTask();

    if (!task)
      return null;

    return new Date(task.date);
  }

  getDaySummaryForTask(): DaySummary | undefined {
    const task = this.selectedTask();

    if (!task)
      return undefined;

    return this.monthlyData().find((day: DaySummary) => day.date === task.date);
  }
}
