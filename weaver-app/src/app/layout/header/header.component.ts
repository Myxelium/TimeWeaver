import { Component, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import {
  LucideAngularModule,
  Eye,
  EyeOff
} from 'lucide-angular';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { format } from 'date-fns';
import { Store } from '@ngrx/store';
import {
  selectMonthlySummary,
  selectSelectedMonth,
  selectIsLoading,
  selectMonthlyData
} from '../../store/tasks/tasks.selectors';
import {
  selectIgnoreWeekends,
  selectMonthlyIncome,
  selectMonthlyCost,
  selectMaxHoursPerDay,
  selectOvertimeRate
} from '../../store/settings/settings.selectors';
import {
  eachDayOfInterval,
  endOfMonth,
  startOfMonth
} from 'date-fns';
import { combineLatest } from 'rxjs';
import { TasksActions } from '../../store/tasks/tasks.actions';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    AsyncPipe,
    DecimalPipe,
    LucideAngularModule
  ],
  templateUrl: './header.component.html',
  host: { style: 'display: block' }
})
export class HeaderComponent {
  eye = Eye;
  eyeOff = EyeOff;
  showEarnedFinance = false;
  showCostFinance = false;
  monthlySummary$ = inject(Store).select(selectMonthlySummary);
  selectedMonth$ = inject(Store).select(selectSelectedMonth);
  isLoading$ = inject(Store).select(selectIsLoading);
  monthlyData$ = inject(Store).select(selectMonthlyData);
  ignoreWeekends$ = inject(Store).select(selectIgnoreWeekends);
  monthlyIncome$ = inject(Store).select(selectMonthlyIncome);
  monthlyCost$ = inject(Store).select(selectMonthlyCost);
  overtimeRate$ = inject(Store).select(selectOvertimeRate);
  maxHoursPerDay$ = inject(Store).select(selectMaxHoursPerDay);

  progressPercentage$: Observable<number> = combineLatest([this.monthlySummary$, this.maxHoursPerDay$]).pipe(
    map(([hours, maxHoursPerDay]) => {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const days = eachDayOfInterval({ start, end });
      const weekdays = days.filter(day => day.getDay() !== 0 && day.getDay() !== 6).length;
      const expectedHours = weekdays * maxHoursPerDay;

      if (expectedHours === 0)
        return 0;

      if (hours <= expectedHours)
        return (hours / expectedHours) * 100;

      return (expectedHours / hours) * 100;
    })
  );

  overtimePercentage$: Observable<number> = combineLatest([this.monthlySummary$, this.maxHoursPerDay$]).pipe(
    map(([hours, maxHoursPerDay]) => {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const days = eachDayOfInterval({ start, end });
      const weekdays = days.filter(day => day.getDay() !== 0 && day.getDay() !== 6).length;
      const expectedHours = weekdays * maxHoursPerDay;

      if (expectedHours === 0 || hours <= expectedHours)
        return 0;

      const overtimeHours = hours - expectedHours;

      return (overtimeHours / hours) * 100;
    })
  );

  hasOvertime$: Observable<boolean> = combineLatest([this.monthlySummary$, this.maxHoursPerDay$]).pipe(
    map(([hours, maxHoursPerDay]) => {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const days = eachDayOfInterval({ start, end });
      const weekdays = days.filter(day => day.getDay() !== 0 && day.getDay() !== 6).length;
      const expectedHours = weekdays * maxHoursPerDay;

      return hours > expectedHours;
    })
  );

  earned$ = this.calculateFinancialProgress('income');
  costed$ = this.calculateFinancialProgress('cost');

  selectedMonthLabel$: Observable<string> = this.selectedMonth$.pipe(
    map((date) => {
      if (!date) {
        const now = new Date();

        return format(now, 'MMMM yyyy');
      }

      return format(new Date(date.year, date.month - 1, 1), 'MMMM yyyy');
    })
  );
  private store = inject(Store);

  toggleCostFinanceVisibility(): void {
    this.showCostFinance = !this.showCostFinance;
  }

  toggleEarnedFinanceVisibility(): void {
    this.showEarnedFinance = !this.showEarnedFinance;
  }

  exportCurrentMonth(): void {
    this.selectedMonth$.pipe(take(1)).subscribe((date) => {
      const now = new Date();
      const year = date?.year ?? now.getFullYear();
      const month = date?.month ?? now.getMonth() + 1;

      this.store.dispatch(TasksActions.exportCsv({ year, month }));
    });
  }

  private calculateFinancialProgress(kind: 'income' | 'cost'): Observable<number> {
    const value$ = kind === 'income' ? this.monthlyIncome$ : this.monthlyCost$;

    return combineLatest([
      this.monthlySummary$,
      value$,
      inject(Store).select(selectMaxHoursPerDay),
      this.overtimeRate$
    ]).pipe(
      map(([
        loggedHours,
        monthlyValue,
        maxHoursPerDay,
        overtimeRate
      ]) => {
        if (!monthlyValue || monthlyValue === 0)
          return 0;

        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const days = eachDayOfInterval({ start, end });
        const weekdays = days.filter(dayItem => dayItem.getDay() !== 0 && dayItem.getDay() !== 6).length;
        const expectedHours = weekdays * maxHoursPerDay;

        if (expectedHours === 0)
          return 0;

        const ratio = Math.min(loggedHours / expectedHours, 1);
        const baseValue = monthlyValue * ratio;
        // Calculate overtime: hours beyond expected hours
        const overtimeHours = Math.max(0, loggedHours - expectedHours);
        const overtimeValue = overtimeHours * (overtimeRate ?? 0);

        return Math.max(0, baseValue + overtimeValue);
      })
    );
  }
}
