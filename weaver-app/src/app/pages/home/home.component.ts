import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PreviousDaysComponent } from './components/previous-days/previous-days.component';
import { TodaysWorkComponent } from './components/todays-work/todays-work.component';
import { Store } from '@ngrx/store';
import { TasksActions } from '../../store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DateChangeDetectionService, HolidayService } from '../../shared/services';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, PreviousDaysComponent, TodaysWorkComponent],
  templateUrl: './home.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  holidayName: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private _store: Store,
    private dateChangeService: DateChangeDetectionService,
    private holidayService: HolidayService
  ) {}

  ngOnInit(): void {
    this.currentDate = this.dateChangeService.currentDate;
    this.loadCurrentDateData();
    this.subscribeToDayChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentDateData(): void {
    const currentDate = this.dateChangeService.currentDate;

    this._store.dispatch(TasksActions.setSelectedMonth({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    }));

    this._store.dispatch(TasksActions.loadMonthlyData({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    }));

    const dateStr = this.dateChangeService.currentDateString;

    this._store.dispatch(TasksActions.setCurrentDate({ date: dateStr }));
    this._store.dispatch(TasksActions.loadTodayTasks({ date: dateStr }));

    this.holidayName = this.holidayService.getHolidayName(currentDate);
  }

  private subscribeToDayChanges(): void {
    this.dateChangeService.currentDate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentDate = this.dateChangeService.currentDate;
        this.loadCurrentDateData();
      });
  }
}
