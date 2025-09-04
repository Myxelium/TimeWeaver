import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../shared/services';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-foreground">All Records</h1>
        <p class="text-muted-foreground mt-2">Complete history of all time entries</p>
      </div>
      
      <div class="bg-card border border-border rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Coming Soon</h2>
        <p class="text-muted-foreground">Complete data table with all historical records will be implemented here.</p>
      </div>
    </div>
  `
})
export class RecordsComponent implements OnInit {
  private stateService = inject(StateService);
  
  ngOnInit(): void {
    this.stateService.refreshAllTasks();
  }
}
