import { Injectable, OnDestroy } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  interval,
  Subject
} from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { format } from 'date-fns';

/**
 * Service to detect when the day changes and notify subscribers.
 * Useful for applications that need to update data when a new day starts.
 */
@Injectable({
  providedIn: 'root'
})
export class DateChangeDetectionService implements OnDestroy {
  private currentDateSubject = new BehaviorSubject<string>(format(new Date(), 'yyyy-MM-dd'));
  private destroy$ = new Subject<void>();

  constructor() {
    this.startDayChangeDetection();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Observable that emits the current date string (yyyy-MM-dd format) whenever the day changes.
   */
  get currentDate$(): Observable<string> {
    return this.currentDateSubject.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Get the current date string synchronously.
   */
  get currentDateString(): string {
    return this.currentDateSubject.value;
  }

  /**
   * Get the current date as a Date object.
   */
  get currentDate(): Date {
    return new Date(this.currentDateSubject.value);
  }

  /**
   * Manually trigger a date check (useful for testing or forcing a refresh).
   */
  checkDate(): void {
    this.checkForDayChange();
  }

  private startDayChangeDetection(): void {
    interval(60000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkForDayChange();
      });
  }

  private checkForDayChange(): void {
    const currentDateStr = format(new Date(), 'yyyy-MM-dd');
    const previousDateStr = this.currentDateSubject.value;

    if (currentDateStr !== previousDateStr) {
      console.log(`Day change detected: ${previousDateStr} -> ${currentDateStr}`);
      this.currentDateSubject.next(currentDateStr);
    }
  }
}
