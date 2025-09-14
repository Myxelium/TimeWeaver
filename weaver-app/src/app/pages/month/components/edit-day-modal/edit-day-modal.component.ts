import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TasksActions, loadAllTasks } from '../../../../store/tasks/tasks.actions';
import { selectAllTasks, selectIsLoading } from '../../../../store/tasks/tasks.selectors';
import { Task, DaySummary, DAILY_WORK_HOURS } from '../../../../shared/models';
import { format, subDays } from 'date-fns';
import { Subject, takeUntil } from 'rxjs';
import { ConfirmService } from '../../../../shared/confirm/confirm.service';

@Component({
  selector: 'app-edit-day-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-day-modal.component.html'
})
export class EditDayModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() selectedDate: Date | null = null;
  @Input() daySummary: DaySummary | undefined;
  @Output() closed = new EventEmitter<void>();

  DAILY_WORK_HOURS = DAILY_WORK_HOURS;
  isLoading$ = inject(Store).select(selectIsLoading);
  taskForm: FormGroup = inject(FormBuilder).group({
    title: ['', Validators.required],
    description: [''],
    hours: [0, [Validators.min(0)]]
  });

  editingTask: Task | null = null;
  showSuggestions = false;
  showAllSuggestions = false;
  allTaskTitles: string[] = [];
  filteredSuggestions: string[] = [];
  recentSuggestions: string[] = [];

  private store = inject(Store);
  private destroy$ = new Subject<void>();
  private confirm = inject(ConfirmService);

  constructor() {
    this.store.dispatch(loadAllTasks());

    this.store
      .select(selectAllTasks)
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        const thirtyDaysAgo = subDays(new Date(), 30);
        const recent = tasks.filter(t => {
          const d = new Date(t.date);
          return d >= thirtyDaysAgo && d <= new Date();
        });
        const unique = [...new Set(recent.map(t => t.title))];
        this.allTaskTitles = unique.reverse();
        this.recentSuggestions = this.allTaskTitles.slice(0, 5);
      });

    this.taskForm
      .get('title')?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(value => this.filterSuggestions(value));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['daySummary'] && this.editingTask) {
      const stillExists = this.daySummary?.tasks?.some(task => task.id === this.editingTask?.id);

      if (!stillExists)
        this.resetForm();
    }

    if (changes['open'] && !this.isOpen) {
      this.resetForm();
    }
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
    const remaining = Math.max(0, DAILY_WORK_HOURS - this.getDayTotalHours());
    const current = this.taskForm.get('hours')?.value || 0;
    this.taskForm.patchValue({ hours: current + remaining });
  }

  onSubmit(): void {
    if (!this.selectedDate || this.taskForm.invalid)
      return;

    const formValue = this.taskForm.value;
    const hours = formValue.hours || 0;
    const dateStr = format(this.selectedDate, 'yyyy-MM-dd');

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
  }

  editTask(task: Task): void {
    this.editingTask = task;
    this.taskForm.patchValue({ title: task.title, description: task.description, hours: task.hours });
  }

  async deleteTask(taskId: number): Promise<void> {
    const confirmed = await this.confirm.confirm({
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
    }, 200);
  }

  selectSuggestion(taskTitle: string): void {
    this.taskForm.patchValue({ title: taskTitle });
    this.showSuggestions = false;
    this.showAllSuggestions = false;
  }

  toggleAllSuggestions(): void {
    this.showAllSuggestions = !this.showAllSuggestions;
    this.filteredSuggestions = this.showAllSuggestions ? this.allTaskTitles.slice(0, 15) : this.recentSuggestions;
    this.showSuggestions = true;
  }

  close(): void {
    this.closed.emit();
  }

  resetForm(): void {
    this.taskForm.reset();
    this.taskForm.patchValue({ hours: 0 });
    this.editingTask = null;
    this.showSuggestions = false; this.showAllSuggestions = false;
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
