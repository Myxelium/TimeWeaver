import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PreviousDaysComponent } from './components/previous-days/previous-days.component';
import { TodaysWorkComponent } from './components/todays-work/todays-work.component';
import { Store } from '@ngrx/store';
import { TasksActions } from '../../store';

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
export class HomeComponent {
  currentDate = new Date();

  constructor(private _store: Store) {
    // Ensure the selected month resets to the current month when navigating to Home
    this._store.dispatch(TasksActions.setSelectedMonth({
      year: this.currentDate.getFullYear(),
      month: this.currentDate.getMonth() + 1
    }));

    this._store.dispatch(TasksActions.loadMonthlyData({
      year: this.currentDate.getFullYear(),
      month: this.currentDate.getMonth() + 1
    }));
  }
}
