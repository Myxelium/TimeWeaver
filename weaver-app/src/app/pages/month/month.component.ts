import { Component, inject, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Store } from '@ngrx/store';
// Removed task action imports; parent no longer dispatches load or navigation actions directly.
import { selectMonthlyData } from '../../store/tasks/tasks.selectors';
import { format } from 'date-fns';
import { Subject, takeUntil } from 'rxjs';
import { DaySummary } from '../../shared/models';
import { TaskHoursSummaryComponent } from './components/task-hours-summary/task-hours-summary.component';
import { MonthlyOverviewComponent } from './components/monthly-overview/monthly-overview.component';
import { EditDayModalComponent } from './components/edit-day-modal/edit-day-modal.component';

// Parent now only coordinates modal visibility and passes summaries to modal.

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
  // Signals used only for modal coordination now
  selectedDay = signal<Date | null>(null);
  showDayModal = signal(false);

  monthlyData$ = inject(Store).select(selectMonthlyData);

  private store = inject(Store);
  private destroy$ = new Subject<void>();
  private monthlyDataCache: DaySummary[] = [];

  // No constructor logic needed; child components handle data loading/navigation.

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(_event: KeyboardEvent): void {
    if (this.showDayModal()) {
      this.closeDayModal();
    }
  }

  // Removed task stats & form helpers; child components own that logic now.

  // (Constructor moved above per ordering rule)

  ngOnInit(): void {
    // Keep cache updated for modal summary access
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

  // ===== Private Helpers =====

  getDaySummarySync(date: Date): DaySummary | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');
    return this.monthlyDataCache.find(d => d.date === dateStr);
  }

  // Removed other private helpers (suggestions, form logic) now owned by child components.

}
