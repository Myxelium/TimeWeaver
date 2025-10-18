import { Component, inject, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Store } from '@ngrx/store';
import { selectMonthlyData } from '../../store/tasks/tasks.selectors';
import { format } from 'date-fns';
import { Subject, takeUntil } from 'rxjs';
import { DaySummary } from '../../shared/models';
import { TaskHoursSummaryComponent } from './components/task-hours-summary/task-hours-summary.component';
import { MonthlyOverviewComponent } from './components/monthly-overview/monthly-overview.component';
import { EditDayModalComponent } from './components/edit-day-modal/edit-day-modal.component';

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
  selectedDay = signal<Date | null>(null);
  showDayModal = signal(false);

  monthlyData$ = inject(Store).select(selectMonthlyData);

  private destroy$ = new Subject<void>();
  private monthlyDataCache: DaySummary[] = [];

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(_event: KeyboardEvent): void {
    if (this.showDayModal()) {
      this.closeDayModal();
    }
  }
  ngOnInit(): void {
    this.monthlyData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => (this.monthlyDataCache = data));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closeDayModal(): void {
    this.showDayModal.set(false);
    this.selectedDay.set(null);
  }

  onDaySelected(date: Date): void {
    this.selectedDay.set(date);
    this.showDayModal.set(true);
  }

  getDaySummarySync(date: Date): DaySummary | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');
    return this.monthlyDataCache.find(d => d.date === dateStr);
  }
}
