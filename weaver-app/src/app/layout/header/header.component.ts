import { Component, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { format } from 'date-fns';
import { Store } from '@ngrx/store';
import { selectMonthlySummary, selectSelectedMonth, selectIsLoading } from '../../store/tasks/tasks.selectors';
import { TasksActions } from '../../store/tasks/tasks.actions';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe],
  template: `
    <header class="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <!-- App Name -->
      <div class="flex items-center">
        <h1 class="text-2xl font-semibold text-foreground">Weaver</h1>
      </div>
      
      <!-- Monthly Summary and Export -->
      <div class="flex items-center space-x-4">
        <!-- Monthly Hours Progress -->
        <div class="flex items-center space-x-3">
          <span class="text-sm text-muted-foreground">{{ currentMonth }}</span>
          <div class="flex items-center space-x-2">
            <div class="w-32 h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                class="h-full bg-primary transition-all duration-300"
                [style.width.%]="progressPercentage$ | async"
              ></div>
            </div>
            <span class="text-sm font-medium">{{ monthlySummary$ | async | number:'1.1-1' }}h</span>
          </div>
        </div>
        
        <!-- Export Button -->
        <button
          (click)="exportCurrentMonth()"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          [disabled]="isLoading$ | async"
        >
          Export CSV
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class HeaderComponent {
  private store = inject(Store);
  
  monthlySummary$ = this.store.select(selectMonthlySummary);
  selectedMonth$ = this.store.select(selectSelectedMonth);
  isLoading$ = this.store.select(selectIsLoading);
  
  progressPercentage$: Observable<number> = this.monthlySummary$.pipe(
    map((hours: number) => Math.min((hours / 160) * 100, 100)) // Assuming 160 hours per month (20 days * 8 hours)
  );
  
  get currentMonth(): string {
    const now = new Date();
    return format(now, 'MMMM yyyy');
  }
  
  exportCurrentMonth(): void {
    const now = new Date();
  this.store.dispatch(TasksActions.exportCsv({ year: now.getFullYear(), month: now.getMonth() + 1 }));
  }
}
