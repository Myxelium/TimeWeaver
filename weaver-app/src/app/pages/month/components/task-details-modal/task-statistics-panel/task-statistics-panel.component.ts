import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  Calendar,
  Clock,
  List,
  LucideAngularModule,
  TrendingUp
} from 'lucide-angular';

export interface TaskStatisticSummary {
  totalHours: number;
  totalTasks: number;
  averageHoursPerDay: number;
  uniqueDays: number;
}

@Component({
  selector: 'app-task-statistics-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './task-statistics-panel.component.html'
})
export class TaskStatisticsPanelComponent {
  @Input({ required: true }) statistics!: TaskStatisticSummary;

  readonly Clock = Clock;
  readonly List = List;
  readonly TrendingUp = TrendingUp;
  readonly Calendar = Calendar;
}
