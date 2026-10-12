import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { Task } from '../../shared/models';
import { loadAllTasks } from '../../store/tasks/tasks.actions';
import { selectAllTasks } from '../../store/tasks/tasks.selectors';
import { StatisticsSummaryComponent, TasksTableComponent } from './components';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [
    CommonModule,
    StatisticsSummaryComponent,
    TasksTableComponent
  ],
  templateUrl: './records.component.html'
})
export class RecordsComponent implements OnInit {
  private store = inject(Store);

  private allTasks = toSignal(this.store.select(selectAllTasks), { initialValue: [] as Task[] });

  searchTerm = signal('');

  filteredTasks = computed(() => this.filterTasks(this.allTasks(), this.searchTerm()));

  ngOnInit(): void {
    this.store.dispatch(loadAllTasks());
  }

  private filterTasks(tasks: Task[], searchTerm: string): Task[] {
    const search = searchTerm.toLowerCase().trim();

    if (!search)
      return tasks;

    return tasks.filter(task =>
      task.title.toLowerCase().includes(search) ||
      task.description?.toLowerCase().includes(search) ||
      task.date.includes(search)
    );
  }
}
