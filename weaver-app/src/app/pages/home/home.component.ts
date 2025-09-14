import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PreviousDaysComponent } from './components/previous-days/previous-days.component';
import { TodaysWorkComponent } from './components/todays-work/todays-work.component';

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
  readonly currentDate = new Date();
}
