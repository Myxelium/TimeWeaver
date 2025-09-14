import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task, DaySummary, CreateTaskRequest, UpdateTaskRequest } from '../models';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private get electronAPI() {
    return (window as any).electronAPI;
  }

  constructor() {
    if (!this.electronAPI) {
      console.warn('Electron API not available. Running in development mode?');
    }
  }

  // Check if running in Electron environment
  private isElectron(): boolean {
    return !!(this.electronAPI);
  }

  // Task operations
  getTasksByDate(date: string): Observable<Task[]> {
    if (!this.isElectron()) {
      return of(this.getMockTasksForDate(date));
    }
    return from(this.electronAPI.query({ type: 'get-tasks-by-date', payload: { date } })).pipe(map(r => r as Task[]));
  }

  saveTask(task: CreateTaskRequest | UpdateTaskRequest): Observable<number> {
    if (!this.isElectron()) {
       console.log('Mock save task:', task);
       return of(Math.random() * 1000);
    }
    return from(this.electronAPI.command({ type: 'save-task', payload: { ...task, hours: task.hours || 0 } })).pipe(map(r => r as number));
  }

  deleteTask(taskId: number): Observable<any> {
    if (!this.isElectron()) {
      console.log('Mock delete task:', taskId);
      return of({ success: true });
    }
    return from(this.electronAPI.command({ type: 'delete-task', payload: { id: taskId } }));
  }

  // Monthly operations
  getTasksByMonth(year: number, month: number): Observable<DaySummary[]> {
    if (!this.isElectron()) {
      return of(this.getMockMonthlyData(year, month));
    }
    return from(this.electronAPI.query({ type: 'get-tasks-by-month', payload: { year, month } })).pipe(map(r => r as DaySummary[]));
  }

  getMonthlySummary(year: number, month: number): Observable<number> {
    if (!this.isElectron()) {
      return of(120);
    }
    return from(this.electronAPI.query({ type: 'get-monthly-summary', payload: { year, month } })).pipe(map(r => r as number));
  }

  // All records
  getAllTasks(): Observable<Task[]> {
    if (!this.isElectron()) {
      return of(this.getMockAllTasks());
    }
    return from(this.electronAPI.query({ type: 'get-all-tasks', payload: {} })).pipe(map(r => r as Task[]));
  }

  // Export functionality
  exportCsv(year: number, month: number): Observable<boolean> {
    if (!this.isElectron()) {
      console.log('Mock CSV export for:', year, month);
      return of(true);
    }
    return from(this.electronAPI.query({ type: 'export-csv', payload: { year, month } })).pipe(map(r => r as boolean));
  }

  // Mock data for development
  private getMockTasksForDate(date: string): Task[] {
    return [
      {
        id: 1,
        title: 'Project Planning',
        description: 'Plan the new feature implementation',
        date: date,
        hours: 4,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Code Review',
        description: 'Review pull requests from team',
        date: date,
        hours: 2,
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        title: 'Documentation',
        description: 'Update API documentation',
        date: date,
        hours: 2,
        created_at: new Date().toISOString()
      }
    ];
  }

  private getMockMonthlyData(year: number, month: number): DaySummary[] {
    const days: DaySummary[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= Math.min(daysInMonth, 10); day++) {
      const taskCount = Math.floor(Math.random() * 5) + 1;
      const tasks: Task[] = [];
      let totalHours = 0;
      
      // Create tasks for this day
      for (let taskIndex = 1; taskIndex <= taskCount; taskIndex++) {
        const hours = Math.random() * 3 + 0.5; // 0.5 to 3.5 hours
        totalHours += hours;
        
        tasks.push({
          id: day * 100 + taskIndex,
          title: `Task ${taskIndex} - Day ${day}`,
          description: `Description for task ${taskIndex} on day ${day}`,
          date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          hours: Math.round(hours * 100) / 100, // Round to 2 decimal places
          created_at: new Date().toISOString()
        });
      }
      
      days.push({
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        total_hours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        task_count: taskCount,
        tasks: tasks
      });
    }
    
    return days;
  }

  private getMockAllTasks(): Task[] {
    const tasks: Task[] = [];
    const today = new Date();
    
    for (let i = 0; i < 20; i++) {
      const date = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
      tasks.push({
        id: i + 1,
        title: `Task ${i + 1}`,
        description: `Description for task ${i + 1}`,
        date: date.toISOString().split('T')[0],
        hours: Math.random() * 8,
        created_at: date.toISOString()
      });
    }
    
    return tasks;
  }
}
