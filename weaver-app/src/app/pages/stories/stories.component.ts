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
import {
  ChevronLeft,
  ChevronRight,
  LucideAngularModule
} from 'lucide-angular';

import { AdoSuggestion, Task } from '../../shared/models';
import { loadAllTasks, TasksActions } from '../../store/tasks/tasks.actions';
import { selectAdoSuggestions, selectAllTasks } from '../../store/tasks/tasks.selectors';
import { StoriesTableComponent } from './stories-table/stories-table.component';
import { StoryTimelineComponent } from './story-timeline/story-timeline.component';
import { storyRowsForYear } from './story-year.model';

@Component({
  selector: 'app-stories',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    StoryTimelineComponent,
    StoriesTableComponent
  ],
  templateUrl: './stories.component.html'
})
export class StoriesComponent implements OnInit {
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  private store = inject(Store);

  private suggestions = toSignal(this.store.select(selectAdoSuggestions), { initialValue: [] as AdoSuggestion[] });
  private tasks = toSignal(this.store.select(selectAllTasks), { initialValue: [] as Task[] });

  year = signal(new Date().getFullYear());
  searchTerm = signal('');

  private yearRows = computed(() => {
    const suggestions = this.suggestions();
    const tasks = this.tasks();
    const year = this.year();

    return storyRowsForYear(suggestions, tasks, year);
  });

  filteredRows = computed(() => {
    const search = this.searchTerm().toLowerCase()
      .trim();

    if (!search)
      return this.yearRows();

    return this.yearRows().filter(row =>
      row.title.toLowerCase().includes(search) ||
      row.started.includes(search) ||
      row.ended.includes(search)
    );
  });

  ngOnInit(): void {
    this.store.dispatch(loadAllTasks());
    this.store.dispatch(TasksActions.loadAdoSuggestions());
  }

  previousYear(): void {
    this.year.update(year => year - 1);
  }

  nextYear(): void {
    this.year.update(year => year + 1);
  }
}
