import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { format } from 'date-fns';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { DaySummary } from '../../shared/models';
import { selectMonthlyData } from '../../store/tasks/tasks.selectors';
import { EditDayModalComponent } from './components/edit-day-modal/edit-day-modal.component';
import { MonthlyOverviewComponent } from './components/monthly-overview/monthly-overview.component';
import { TaskHoursSummaryComponent } from './components/task-hours-summary/task-hours-summary.component';

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ReactiveFormsModule,
    TaskHoursSummaryComponent,
    MonthlyOverviewComponent,
    EditDayModalComponent
  ],
  templateUrl: './month.component.html'
})
export class MonthComponent implements OnInit, OnDestroy {
  @ViewChild(MonthlyOverviewComponent) private monthlyOverview?: MonthlyOverviewComponent;
  @ViewChild(EditDayModalComponent) private editDayModal?: EditDayModalComponent;

  selectedDay = signal<Date | null>(null);
  showDayModal = signal(false);
  rangeDates = signal<Date[] | null>(null);
  monthlyData = signal<DaySummary[]>([]);

  monthlyData$ = inject(Store).select(selectMonthlyData);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.monthlyData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.monthlyData.set(data));
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.editDayModal?.taskDetailsOpen) {
      event.stopPropagation();
      this.editDayModal.closeTaskDetails();
      return;
    }

    if (this.showDayModal())
      this.closeDayModal();
  }

  closeDayModal(): void {
    this.showDayModal.set(false);
    this.selectedDay.set(null);
    this.rangeDates.set(null);
  }

  onDaySelected(date: Date): void {
    this.rangeDates.set(null);
    this.selectedDay.set(date);
    this.showDayModal.set(true);
  }

  onRegisterRange(dates: Date[]): void {
    if (dates.length === 0)
      return;

    this.rangeDates.set(dates);
    this.selectedDay.set(dates[0]);
    this.showDayModal.set(true);
  }

  onDateChange(date: Date): void {
    this.selectedDay.set(date);
    this.monthlyOverview?.showMonthOf(date);
  }

  getDaySummarySync(date: Date): DaySummary | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');

    return this.monthlyData().find(daySummary => daySummary.date === dateStr);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
