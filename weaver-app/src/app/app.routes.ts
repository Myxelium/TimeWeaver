import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'month',
    loadComponent: () => import('./pages/month/month.component').then(m => m.MonthComponent)
  },
  {
    path: 'records',
    loadComponent: () => import('./pages/records/records.component').then(m => m.RecordsComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
