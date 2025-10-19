import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../../../shared/models';

type EditableTask = Task & { editing?: boolean };

@Component({
  selector: 'app-task-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-details-modal.component.html'
})
export class TaskDetailsModalComponent {
  @Input() isOpen = false;
  @Input() title: string | null = null;
  @Input() set tasks(value: Task[] | null) {
    const arr = value ?? [];

    this.localTasks = arr.map(task => ({ ...task, editing: false }));
  }

  @Output() closed = new EventEmitter<void>();
  @Output() saveTask = new EventEmitter<{ id: number; title: string; description?: string; date: string; hours: number }>();

  localTasks: EditableTask[] = [];

  onClose(): void {
    this.closed.emit();
  }

  enableEdit(index: number): void {
    this.localTasks[index].editing = true;
  }

  cancel(index: number): void {
    const task = this.localTasks[index];

    if (!task)
      return;

    // revert editing state only; parent owns truth, so next open will re-clone
    task.editing = false;
  }

  save(index: number): void {
    const task = this.localTasks[index];

    if (!task || !task.id)
      return;

    this.saveTask.emit({
      id: task.id,
      title: (task.title || '').trim(),
      description: task.description || '',
      date: task.date,
      hours: Number(task.hours) || 0
    });

    task.editing = false;
  }
}
