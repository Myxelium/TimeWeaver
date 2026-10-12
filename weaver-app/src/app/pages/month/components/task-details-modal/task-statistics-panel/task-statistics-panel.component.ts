import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  BarChart3,
  Calendar,
  Clock,
  LucideAngularModule,
  TrendingUp
} from 'lucide-angular';

export interface TaskStatisticSummary {
  totalHours: number;
  totalItems: number;
  calculatedDays: number;
  averageHoursPerDay: number;
  dateRange: { start: string | null; end: string | null };
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
  readonly BarChart3 = BarChart3;
  readonly TrendingUp = TrendingUp;
  readonly Calendar = Calendar;
}
