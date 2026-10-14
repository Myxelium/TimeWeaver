import {
  computed,
  inject,
  Injectable,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { loadAllTasks, TasksActions } from '../../store/tasks/tasks.actions';
import { selectAdoSuggestions, selectAllTasks } from '../../store/tasks/tasks.selectors';
import { syncedWorkItemId } from '../ado-titles.model';
import { AdoSuggestion, Task } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TaskDetailsService {
  private store = inject(Store);

  private selectedTitle = signal<string | null>(null);
  private selectedWorkItemId = signal<number | null>(null);
  private open = signal(false);

  private allTasks = toSignal(this.store.select(selectAllTasks), { initialValue: [] as Task[] });
  private suggestions = toSignal(this.store.select(selectAdoSuggestions), { initialValue: [] as AdoSuggestion[] });

  isOpen = this.open.asReadonly();
  title = this.selectedTitle.asReadonly();

  detailedTasks = computed(() => {
    const title = this.selectedTitle();

    if (!title)
      return [] as Task[];

    const key = title.trim();
    const adoId = syncedWorkItemId(key, this.selectedWorkItemId(), this.suggestions());

    return this.allTasks()
      .filter(task => this.sameStory(task, key, adoId))
      .sort((left, right) => left.date.localeCompare(right.date) || (left.id ?? 0) - (right.id ?? 0));
  });

  openDetails(title: string, adoWorkItemId?: number | null): void {
    this.selectedTitle.set(title.trim() || title);
    this.selectedWorkItemId.set(adoWorkItemId ?? null);
    this.open.set(true);
    this.store.dispatch(loadAllTasks());
  }

  closeDetails(): void {
    this.open.set(false);
    this.selectedTitle.set(null);
    this.selectedWorkItemId.set(null);
  }

  saveTask(updated: { id: number; title: string; description?: string; date: string; hours: number }): void {
    this.store.dispatch(TasksActions.saveTask({
      task: {
        id: updated.id,
        title: (updated.title || '').trim(),
        description: updated.description || '',
        date: updated.date,
        hours: updated.hours || 0
      }
    }));
  }

  private sameStory(task: Task, title: string, adoId: number | null): boolean {
    const taskTitle = (task.title || '').trim();

    if (taskTitle === title)
      return true;

    if (adoId == null)
      return false;

    return task.adoWorkItemId === adoId || taskTitle === `#${adoId}` || taskTitle.startsWith(`#${adoId} `);
  }
}
