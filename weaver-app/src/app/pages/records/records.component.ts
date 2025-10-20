import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { loadAllTasks } from '../../store/tasks/tasks.actions';
import { StatisticsSummaryComponent, TasksTableComponent } from './components';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, StatisticsSummaryComponent, TasksTableComponent],
  templateUrl: './records.component.html'
})
export class RecordsComponent implements OnInit {
  private store = inject(Store);

  ngOnInit(): void {
    this.store.dispatch(loadAllTasks());
  }
}
