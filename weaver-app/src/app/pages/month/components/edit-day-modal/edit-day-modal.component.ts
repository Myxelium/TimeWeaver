import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Store } from '@ngrx/store';
import {
  addDays,
  format,
  subDays
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  List,
  LucideAngularModule
} from 'lucide-angular';
import {
  combineLatest,
  Observable,
  Subject,
  takeUntil
} from 'rxjs';

import { AdoSuggestionTableComponent } from '../../../../shared/ado-suggestion-table/ado-suggestion-table.component';
import { suggestionsOnDay, titlesForLogging } from '../../../../shared/ado-titles.model';
import { ConfirmService } from '../../../../shared/confirm/confirm.service';
import {
  AdoSuggestion,
  DaySummary,
  Task,
  UpdateTaskRequest
} from '../../../../shared/models';
import { HolidayService } from '../../../../shared/services';
import { selectMaxHoursEnabled, selectMaxHoursPerDay } from '../../../../store/settings/settings.selectors';
import { loadAllTasks, TasksActions } from '../../../../store/tasks/tasks.actions';
import {
  selectAdoSuggestions,
  selectAllTasks,
  selectIsLoading
} from '../../../../store/tasks/tasks.selectors';
import { TaskDetailsModalComponent } from '../task-details-modal/task-details-modal.component';
import { DaySummaryPanelComponent } from './day-summary-panel/day-summary-panel.component';
import { DayTaskFormComponent } from './day-task-form/day-task-form.component';
import { DayTasksListComponent } from './day-tasks-list/day-tasks-list.component';
import { fitHoursToMax } from './fit-hours.model';
import { RangeDayListComponent } from './range-day-list/range-day-list.component';

const HOUR_HUNDREDTHS = 100;
const titleBlurDelayMs = 200;
const expandedTitleCount = 15;
const recentTitleWindowDays = 30;
const collapsedTitleCount = 5;

function shareForNewTask(remainingHours: number, taskCount: number): number {
  if (taskCount <= 0)
    return 0;

  const totalHundredths = Math.max(0, Math.round(remainingHours * HOUR_HUNDREDTHS));

  return Math.floor(totalHundredths / taskCount) / HOUR_HUNDREDTHS;
}

interface RangeDayRow {
  dateKey: string;
  date: Date;
  totalHours: number;
  tasks: Task[];
  holidayName: string | null;
  suggestions: AdoSuggestion[];
  loggedIds: number[];
}

@Component({
  selector: 'app-edit-day-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DaySummaryPanelComponent,
    DayTasksListComponent,
    DayTaskFormComponent,
    RangeDayListComponent,
    AdoSuggestionTableComponent,
    TaskDetailsModalComponent
  ],
  templateUrl: './edit-day-modal.component.html'
})
export class EditDayModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() selectedDate: Date | null = null;

  @Input() daySummary: DaySummary | undefined;

  @Input() rangeDates: Date[] | null = null;

  @Input() monthDays: DaySummary[] = [];

  @Input() allowDateChange = false; // New flag to enable date editing
  @Input() singleTaskMode = false; // New flag for editing single task from records
  @Input() taskToEdit: Task | null = null; // Direct task to edit (for records page)

  @Output() closed = new EventEmitter<void>();
  @Output() dateChange = new EventEmitter<Date>();

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly List = List;

  taskDetailsOpen = false;
  taskDetailsTitle: string | null = null;

  taskDetailsTasks: Task[] = [];

  maxHoursPerDay$: Observable<number> = inject(Store).select(selectMaxHoursPerDay);
  maxHoursEnabled$: Observable<boolean> = inject(Store).select(selectMaxHoursEnabled);
  isLoading$ = inject(Store).select(selectIsLoading);
  taskForm: FormGroup = inject(FormBuilder).group({
    title: ['', Validators.required],
    description: [''],
    hours: [0, [Validators.min(0)]],
    date: ['', Validators.required] // Add date field to form
  });

  editingTask: Task | null = null;
  showSuggestions = false;
  showAllSuggestions = false;

  allTaskTitles: string[] = [];
  filteredSuggestions: string[] = [];
  recentSuggestions: string[] = [];

  holidayName: string | null = null;

  adoSuggestions: AdoSuggestion[] = [];

  private store = inject(Store);

  private destroy$ = new Subject<void>();

  private confirm = inject(ConfirmService);
  private holidayService = inject(HolidayService);

  private maxHoursPerDay = 8;
  private maxHoursEnabled = true;

  private allTasks: Task[] = [];

  private pendingSuggestionHours = new Map<string, { adoId: number; title: string; hours: number }[]>();

  constructor() {
    this.store.dispatch(loadAllTasks());

    combineLatest([this.store.select(selectAllTasks), this.store.select(selectAdoSuggestions)])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([tasks, suggestions]) => {
        const thirtyDaysAgo = subDays(new Date(), recentTitleWindowDays);
        const recent = tasks.filter(taskItem => {
          const dateObj = new Date(taskItem.date);

          return dateObj >= thirtyDaysAgo && dateObj <= new Date();
        });
        const taskTitles = [...new Set(recent.map(taskItem => taskItem.title))].reverse();

        this.allTasks = tasks;
        this.adoSuggestions = suggestions;
        this.allTaskTitles = titlesForLogging(taskTitles, suggestions);
        this.recentSuggestions = this.allTaskTitles.slice(0, collapsedTitleCount);

        if (this.taskDetailsOpen)
          this.refreshTaskDetails();
      });

    this.taskForm
      .get('title')?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(value => this.filterSuggestions(value));

    this.maxHoursPerDay$
      .pipe(takeUntil(this.destroy$))
      .subscribe(hours => {
        this.maxHoursPerDay = hours;
      });

    this.maxHoursEnabled$
      .pipe(takeUntil(this.destroy$))
      .subscribe(enabled => {
        this.maxHoursEnabled = enabled;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['daySummary'] && this.editingTask) {
      const stillExists = this.daySummary?.tasks?.some(task => task.id === this.editingTask?.id);

      if (!stillExists)
        this.resetForm();
    }

    if (changes['rangeDates'] && this.isRangeMode)
      this.editingTask = null;

    if (changes['selectedDate'] && this.selectedDate) {
      const dateStr = format(this.selectedDate, 'yyyy-MM-dd');

      this.taskForm.patchValue({ date: dateStr });

      this.holidayName = this.holidayService.getHolidayName(this.selectedDate);

      if (this.editingTask && this.editingTask.date !== dateStr)
        this.resetForm();
    }

    if (changes['taskToEdit'] && this.taskToEdit) {
      this.editTask(this.taskToEdit);
    }

    if (changes['isOpen']) {
      if (!this.isOpen) {
        this.taskDetailsOpen = false;
        this.resetForm();
      } else if (this.taskToEdit) {
        this.editTask(this.taskToEdit);
      }
    }
  }

  get isRangeMode(): boolean {
    return (this.rangeDates?.length ?? 0) > 1;
  }

  get showDayNavigation(): boolean {
    return !this.allowDateChange && !this.singleTaskMode && !this.isRangeMode && !!this.selectedDate;
  }

  get rangeStartDate(): Date | null {
    return this.rangeDates?.[0] ?? null;
  }

  get rangeEndDate(): Date | null {
    if (!this.rangeDates?.length)
      return null;

    return this.rangeDates[this.rangeDates.length - 1];
  }

  suggestionsForDate(date: Date | null): AdoSuggestion[] {
    if (!date)
      return [];

    return suggestionsOnDay(this.adoSuggestions, format(date, 'yyyy-MM-dd'));
  }

  get rangeDayRows(): RangeDayRow[] {
    if (!this.rangeDates?.length)
      return [];

    return this.rangeDates.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const summary = this.monthDays.find(day => day.date === dateKey);

      return {
        dateKey,
        date,
        totalHours: summary?.total_hours ?? 0,
        tasks: summary?.tasks ?? [],
        holidayName: this.holidayService.getHolidayName(date),
        suggestions: this.suggestionsForDate(date),
        loggedIds: this.loggedSuggestionIds(date)
      };
    });
  }

  previousDay(): void {
    if (!this.selectedDate)
      return;

    this.dateChange.emit(subDays(this.selectedDate, 1));
  }

  nextDay(): void {
    if (!this.selectedDate)
      return;

    this.dateChange.emit(addDays(this.selectedDate, 1));
  }

  getDayTotalHours(): number {
    return this.daySummary?.total_hours || 0;
  }

  getDayTaskCount(): number {
    return this.daySummary?.task_count || 0;
  }

  getDayTasks(): Task[] {
    return this.daySummary?.tasks || [];
  }

  addRemainingHours(): void {
    this.maxHoursPerDay$.subscribe(maxHours => {
      const remaining = Math.max(0, maxHours - this.getDayTotalHours());
      const current = this.taskForm.get('hours')?.value || 0;

      this.taskForm.patchValue({ hours: current + remaining });
    }).unsubscribe();
  }

  canFitTasksToMax(): boolean {
    if (!this.maxHoursEnabled || this.maxHoursPerDay <= 0)
      return false;

    const tasks = this.tasksToFit();

    if (!tasks.some(task => task.hours > 0))
      return false;

    const totalHundredths = Math.round(tasks.reduce((sum, task) => sum + task.hours, 0) * HOUR_HUNDREDTHS);
    const maxHundredths = Math.round(this.maxHoursPerDay * HOUR_HUNDREDTHS);

    return totalHundredths > maxHundredths;
  }

  fitTasksToMaxHours(): void {
    const tasks = this.tasksToFit();
    const fitted = fitHoursToMax(tasks.map(task => task.hours), this.maxHoursPerDay);
    const updates = this.hourUpdates(tasks, fitted);

    if (updates.length === 0)
      return;

    this.store.dispatch(TasksActions.saveTasks({ tasks: updates }));
    this.applyFittedHours(tasks, fitted);
  }

  onSubmit(): void {
    if (this.taskForm.invalid)
      return;

    const formValue = this.taskForm.value;
    const hours = formValue.hours || 0;

    if (this.isRangeMode && this.rangeDates?.length) {
      this.store.dispatch(
        TasksActions.saveTasks({
          tasks: this.rangeDates.map(date => ({
            title: formValue.title,
            description: formValue.description,
            date: format(date, 'yyyy-MM-dd'),
            hours
          }))
        })
      );

      this.resetForm();
      return;
    }

    const dateStr = this.allowDateChange ? formValue.date : (this.selectedDate ? format(this.selectedDate, 'yyyy-MM-dd') : '');

    if (!dateStr)
      return;

    if (this.editingTask) {
      this.store.dispatch(
        TasksActions.saveTask({
          task: {
            id: this.editingTask.id,
            title: formValue.title,
            description: formValue.description,
            date: dateStr,
            hours
          }
        })
      );
    }
    else
    {
      this.store.dispatch(
        TasksActions.saveTask({
          task: {
            title: formValue.title,
            description: formValue.description,
            date: dateStr,
            hours
          }
        })
      );
    }

    this.resetForm();

    if (this.singleTaskMode) {
      this.closeModal();
    }
  }

  editTask(task: Task): void {
    this.editingTask = task;
    this.taskForm.patchValue({
      title: task.title,
      description: task.description,
      hours: task.hours,
      date: task.date
    });
  }

  async deleteTask(taskId: number): Promise<void> {
    const confirmed = await this.confirm.requestConfirmation({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?\nThis action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true
    });

    if (confirmed)
      this.store.dispatch(TasksActions.deleteTask({ taskId }));
  }

  onTitleFocus(): void {
    const value = this.taskForm.get('title')?.value;

    if (value) {
      this.filterSuggestions(value);
    } else {
      this.filteredSuggestions = this.recentSuggestions;
      this.showSuggestions = this.recentSuggestions.length > 0;
    }
  }

  onTitleBlur(): void {
    setTimeout(() => {
      this.showSuggestions = false;
      this.showAllSuggestions = false;
    }, titleBlurDelayMs);
  }

  selectSuggestion(taskTitle: string): void {
    this.taskForm.patchValue({ title: taskTitle });
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  toggleAllSuggestions(): void {
    this.showAllSuggestions = !this.showAllSuggestions;
    this.filteredSuggestions = this.showAllSuggestions ? this.allTaskTitles.slice(0, expandedTitleCount) : this.recentSuggestions;
    this.showSuggestions = true;
  }

  loggedSuggestionIds(date: Date | null): number[] {
    if (!date)
      return [];

    const dateKey = format(date, 'yyyy-MM-dd');
    const tasks = this.tasksForDate(date);
    const logged = this.suggestionsForDate(date)
      .filter(item => this.suggestionIsLogged(dateKey, tasks, item))
      .map(item => item.adoId);

    return logged;
  }

  addSuggestion(date: Date | null, item: AdoSuggestion): void {
    if (!date)
      return;

    const dateKey = format(date, 'yyyy-MM-dd');
    const tasks = this.tasksForDate(date);
    const carriedHours = this.pendingHours(dateKey, tasks);

    if (this.suggestionIsLogged(dateKey, tasks, item))
      return;

    const unlogged = this.suggestionsForDate(date)
      .filter(suggestion => !this.suggestionIsLogged(dateKey, tasks, suggestion));
    const loggedHours = this.hoursForDate(date) + carriedHours;
    const remainingHours = Math.max(0, this.maxHoursPerDay - loggedHours);
    const hours = shareForNewTask(remainingHours, unlogged.length);
    const pending = this.pendingSuggestionHours.get(dateKey) ?? [];

    pending.push({ adoId: item.adoId, title: item.title.trim(), hours });
    this.pendingSuggestionHours.set(dateKey, pending);
    this.store.dispatch(TasksActions.saveTask({
      task: {
        title: item.title.trim(),
        date: dateKey,
        hours
      }
    }));
  }

  openTaskDetails(): void {
    this.store.dispatch(loadAllTasks());
    this.refreshTaskDetails();
    this.taskDetailsOpen = true;
  }

  closeTaskDetails(): void {
    this.taskDetailsOpen = false;
  }

  saveDetailedTask(updated: { id: number; title: string; description?: string; date: string; hours: number }): void {
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

  closeModal(): void {
    this.taskDetailsOpen = false;
    this.closed.emit();
  }

  resetForm(): void {
    const today = new Date();
    const dateSource = this.selectedDate ?? today;
    const currentDate = format(dateSource, 'yyyy-MM-dd');

    this.taskForm.reset();
    this.taskForm.patchValue({ hours: 0, date: currentDate });
    this.editingTask = null;
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  private tasksForDate(date: Date): Task[] {
    const dateKey = format(date, 'yyyy-MM-dd');

    if (this.daySummary?.date === dateKey)
      return this.daySummary.tasks ?? [];

    return this.monthDays.find(day => day.date === dateKey)?.tasks ?? [];
  }

  private hoursForDate(date: Date): number {
    const dateKey = format(date, 'yyyy-MM-dd');

    if (this.daySummary?.date === dateKey)
      return this.daySummary.total_hours ?? 0;

    return this.monthDays.find(day => day.date === dateKey)?.total_hours ?? 0;
  }

  private suggestionIsLogged(dateKey: string, tasks: Task[], item: AdoSuggestion): boolean {
    const title = item.title.trim();
    const onDay = tasks.some(task => task.adoWorkItemId === item.adoId || task.title.trim() === title);
    const pending = this.pendingSuggestionHours.get(dateKey) ?? [];

    return onDay || pending.some(entry => entry.adoId === item.adoId);
  }

  private pendingHours(dateKey: string, tasks: Task[]): number {
    const pending = (this.pendingSuggestionHours.get(dateKey) ?? [])
      .filter(entry => !tasks.some(task => task.adoWorkItemId === entry.adoId || task.title.trim() === entry.title));

    this.pendingSuggestionHours.set(dateKey, pending);

    return pending.reduce((sum, entry) => sum + entry.hours, 0);
  }

  private refreshTaskDetails(): void {
    const tasks = this.tasksForDetails();

    if (!this.sameTasks(this.taskDetailsTasks, tasks))
      this.taskDetailsTasks = tasks;

    this.taskDetailsTitle = this.detailsTitle(tasks);
  }

  private detailSeeds(): Task[] {
    if (this.isRangeMode)
      return (this.rangeDates ?? []).flatMap(date => this.tasksForDate(date));

    return this.selectedDate ? this.tasksForDate(this.selectedDate) : [];
  }

  private tasksForDetails(): Task[] {
    const seeds = this.detailSeeds();
    const titles = new Set(seeds.map(task => this.taskKey(task.title)).filter(title => title.length > 0));
    const ids = new Set(seeds.flatMap(task => task.adoWorkItemId == null ? [] : [task.adoWorkItemId]));
    const fromHistory = this.allTasks.filter(task => {
      const title = this.taskKey(task.title);

      return (title.length > 0 && titles.has(title)) || (task.adoWorkItemId != null && ids.has(task.adoWorkItemId));
    });

    return this.mergeTaskRecords(fromHistory, seeds)
      .sort((left, right) => left.date.localeCompare(right.date) || (left.id ?? 0) - (right.id ?? 0));
  }

  private detailsTitle(tasks: Task[]): string | null {
    const titles = [...new Set(tasks.map(task => this.taskKey(task.title)).filter(title => title.length > 0))];

    return titles.length === 1 ? titles[0] : null;
  }

  private taskKey(title: string | null | undefined): string {
    return (title || '').trim();
  }

  private mergeTaskRecords(stored: Task[], fromDay: Task[]): Task[] {
    const byId = new Map<number, Task>();
    const withoutId: Task[] = [];

    for (const task of [...stored, ...fromDay]) {
      if (task.id == null) {
        withoutId.push(task);
        continue;
      }

      if (!byId.has(task.id))
        byId.set(task.id, task);
    }

    return [...byId.values(), ...withoutId];
  }

  private sameTasks(left: Task[], right: Task[]): boolean {
    if (left.length !== right.length)
      return false;

    return left.every((task, index) => {
      const other = right[index];

      return task.id === other.id
        && task.date === other.date
        && task.hours === other.hours
        && task.title === other.title
        && (task.description || '') === (other.description || '');
    });
  }

  private tasksToFit(): (Task & { id: number })[] {
    const tasks: (Task & { id: number })[] = [];

    for (const task of this.getDayTasks()) {
      if (task.id == null)
        continue;

      tasks.push({ ...task, id: task.id });
    }

    return tasks;
  }

  private hourUpdates(tasks: (Task & { id: number })[], fitted: number[]): UpdateTaskRequest[] {
    return tasks.flatMap((task, index) => {
      const hours = fitted[index];

      if (hours == null || hours === task.hours)
        return [];

      return [
        {
          id: task.id,
          title: task.title,
          description: task.description,
          date: task.date,
          hours
        }
      ];
    });
  }

  private applyFittedHours(tasks: (Task & { id: number })[], fitted: number[]): void {
    const editingId = this.editingTask?.id;

    if (editingId == null)
      return;

    const index = tasks.findIndex(task => task.id === editingId);
    const hours = fitted[index];

    if (index >= 0 && hours != null)
      this.taskForm.patchValue({ hours });
  }

  private filterSuggestions(value: string): void {
    if (!value || value.length < 1) {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
      return;
    }

    const search = value.toLowerCase();

    this.filteredSuggestions = this.allTaskTitles.filter(task => task.toLowerCase().includes(search)).slice(0, 10);
    this.showSuggestions = this.filteredSuggestions.length > 0;
  }
}
