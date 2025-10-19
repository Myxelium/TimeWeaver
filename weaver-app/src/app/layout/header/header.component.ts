import { Component, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { format } from 'date-fns';
import { Store } from '@ngrx/store';
import { selectMonthlySummary, selectSelectedMonth, selectIsLoading, selectMonthlyData } from '../../store/tasks/tasks.selectors';
import { selectIgnoreWeekends, selectMonthlyIncome, selectMonthlyCost } from '../../store/settings/settings.selectors';
import { DAILY_WORK_HOURS } from '../../shared/models';
import { eachDayOfInterval, endOfMonth, startOfMonth } from 'date-fns';
import { combineLatest } from 'rxjs';
import { TasksActions } from '../../store/tasks/tasks.actions';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe, LucideAngularModule],
  templateUrl: './header.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
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
  progressPercentage$: Observable<number> = this.monthlySummary$.pipe(
    map((hours: number) => Math.min((hours / 160) * 100, 100))
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

    return combineLatest([this.monthlySummary$, value$]).pipe(
      map(([loggedHours, monthlyValue]) => {
        if (!monthlyValue || monthlyValue === 0)
          return 0;

        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const days = eachDayOfInterval({ start, end });
        const weekdays = days.filter(dayItem => dayItem.getDay() !== 0 && dayItem.getDay() !== 6).length;
        const expectedHours = weekdays * DAILY_WORK_HOURS;

        if (expectedHours === 0)
          return 0;

        const ratio = loggedHours / expectedHours;
        const value = monthlyValue * ratio;

        return Math.max(0, Math.min(value, monthlyValue));
      })
    );
  }
}
