import { Injectable, OnDestroy } from '@angular/core';
import { format } from 'date-fns';
import {
  BehaviorSubject,
  interval,
  Observable,
  Subject
} from 'rxjs';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';

const dayCheckIntervalMs = 60000;

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

  get currentDate$(): Observable<string> {
    return this.currentDateSubject.asObservable().pipe(distinctUntilChanged());
  }

  get currentDateString(): string {
    return this.currentDateSubject.value;
  }

  get currentDate(): Date {
    return new Date(this.currentDateSubject.value);
  }

  checkDate(): void {
    this.checkForDayChange();
  }

  private startDayChangeDetection(): void {
    interval(dayCheckIntervalMs)
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
