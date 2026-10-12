import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy,
  OnInit
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { DateChangeDetectionService, HolidayService } from '../../shared/services';
import { TasksActions } from '../../store';
import { PreviousDaysComponent } from './components/previous-days/previous-days.component';
import { TodaysWorkComponent } from './components/todays-work/todays-work.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    PreviousDaysComponent,
    TodaysWorkComponent
  ],
  templateUrl: './home.component.html',
  host: { style: 'display: block' }
})
export class HomeComponent implements OnInit, OnDestroy {
  currentDate = new Date();

  holidayName: string | null = null;

  private destroy$ = new Subject<void>();

  private _store = inject(Store);
  private dateChangeService = inject(DateChangeDetectionService);
  private holidayService = inject(HolidayService);

  ngOnInit(): void {
    this.currentDate = this.dateChangeService.currentDate;
    this.loadCurrentDateData();
    this.subscribeToDayChanges();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
