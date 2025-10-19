import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { selectAllTasks, selectMonthlyData } from '../../../../store/tasks/tasks.selectors';
import { TasksActions } from '../../../../store/tasks/tasks.actions';
import { LucideAngularModule, Search, ArrowUpDown, ArrowUp, ArrowDown, Calendar, Clock, FileText, AlignLeft } from 'lucide-angular';
import { Task, DaySummary } from '../../../../shared/models';
import { toSignal } from '@angular/core/rxjs-interop';
import { EditDayModalComponent } from '../../../month/components/edit-day-modal/edit-day-modal.component';

type SortField = 'date' | 'title' | 'hours';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-tasks-table',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, EditDayModalComponent],
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

  searchTerm = signal('');
  sortField = signal<SortField>('date');
  sortDirection = signal<SortDirection>('desc');

  showEditModal = signal(false);
  selectedTask = signal<Task | null>(null);

  filteredAndSortedTasks = computed(() => {
    let tasks = [...this.allTasks()];

    const search = this.searchTerm()
      .toLowerCase()
      .trim();

    if (search) {
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(search) ||
        task.description?.toLowerCase().includes(search) ||
        task.date.includes(search)
      );
    }

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

  private allTasks = toSignal(this._store.select(selectAllTasks), { initialValue: [] });
  private monthlyData = toSignal(this._store.select(selectMonthlyData), { initialValue: [] });

  constructor(private _store: Store) {}

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

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
