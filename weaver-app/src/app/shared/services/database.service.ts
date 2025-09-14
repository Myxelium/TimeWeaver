import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task, DaySummary, CreateTaskRequest, UpdateTaskRequest } from '../models';

interface ElectronAPI {
  query(request: { type: string; payload: unknown }): Promise<unknown>;
  command(request: { type: string; payload: unknown }): Promise<unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private get electronAPI(): ElectronAPI | undefined {
    return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
  }

  constructor() {
    if (!this.electronAPI) {
      console.warn('Electron API not available. Running in development mode?');
    }
  }

  getTasksByDate(date: string): Observable<Task[]> {
    if (!this.isElectron()) {
      return of(this.getMockTasksForDate(date));
    } else {
      const api = this.electronAPI;
      if (!api) return of([]);
      return from(api.query({ type: 'get-tasks-by-date', payload: { date } })).pipe(map(r => r as Task[]));
    }
  }

  saveTask(task: CreateTaskRequest | UpdateTaskRequest): Observable<number> {
    if (!this.isElectron()) {
      console.log('Mock save task:', task);
      return of(Math.random() * 1000);
    } else {
      const api = this.electronAPI;
      if (!api) return of(0);
      return from(api.command({ type: 'save-task', payload: { ...task, hours: task.hours || 0 } })).pipe(map(r => r as number));
    }
  }

  deleteTask(taskId: number): Observable<unknown> {
    if (!this.isElectron()) {
      console.log('Mock delete task:', taskId);
      return of({ success: true });
    } else {
      const api = this.electronAPI;
      if (!api) return of({ success: true });
      return from(api.command({ type: 'delete-task', payload: { id: taskId } }));
    }
  }

  getTasksByMonth(year: number, month: number): Observable<DaySummary[]> {
    if (!this.isElectron()) {
      return of(this.getMockMonthlyData(year, month));
    } else {
      const api = this.electronAPI;
      if (!api) return of([]);
      return from(api.query({ type: 'get-tasks-by-month', payload: { year, month } })).pipe(map(r => r as DaySummary[]));
    }
  }

  getMonthlySummary(year: number, month: number): Observable<number> {
    if (!this.isElectron()) {
      return of(120);
    } else {
      const api = this.electronAPI;
      if (!api) return of(0);
      return from(api.query({ type: 'get-monthly-summary', payload: { year, month } })).pipe(map(r => r as number));
    }
  }

  getAllTasks(): Observable<Task[]> {
    if (!this.isElectron()) {
      return of(this.getMockAllTasks());
    } else {
      const api = this.electronAPI;
      if (!api) return of([]);
      return from(api.query({ type: 'get-all-tasks', payload: {} })).pipe(map(r => r as Task[]));
    }
  }

  exportCsv(year: number, month: number): Observable<boolean> {
    if (!this.isElectron()) {
      console.log('Mock CSV export for:', year, month);
      return of(true);
    } else {
      const api = this.electronAPI;
      if (!api) return of(false);
      return from(api.query({ type: 'export-csv', payload: { year, month } })).pipe(map(r => r as boolean));
    }
  }

  // ===== Private Helpers =====
  private isElectron(): boolean {
    return !!this.electronAPI;
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

    for (let dayNum = 1; dayNum <= Math.min(daysInMonth, 10); dayNum++) {
      const taskCount = Math.floor(Math.random() * 5) + 1;
      const tasks: Task[] = [];
      let totalHours = 0;

      for (let taskIndex = 1; taskIndex <= taskCount; taskIndex++) {
        const hours = Math.random() * 3 + 0.5;
        totalHours += hours;

        tasks.push({
          id: dayNum * 100 + taskIndex,
          title: `Task ${taskIndex} - Day ${dayNum}`,
          description: `Description for task ${taskIndex} on day ${dayNum}`,
          date: `${year}-${month.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`,
          hours: Math.round(hours * 100) / 100,
          created_at: new Date().toISOString()
        });
      }

      days.push({
        date: `${year}-${month.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`,
        total_hours: Math.round(totalHours * 100) / 100,
        task_count: taskCount,
        tasks: tasks
      });
    }

    return days;
  }

  private getMockAllTasks(): Task[] {
    const tasks: Task[] = [];
    const today = new Date();

    for (let index = 0; index < 20; index++) {
      const date = new Date(today.getTime() - (index * 24 * 60 * 60 * 1000));
      tasks.push({
        id: index + 1,
        title: `Task ${index + 1}`,
        description: `Description for task ${index + 1}`,
        date: date.toISOString().split('T')[0],
        hours: Math.random() * 8,
        created_at: date.toISOString()
      });
    }

    return tasks;
  }
}
