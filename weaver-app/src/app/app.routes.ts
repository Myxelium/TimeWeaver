import { Type } from '@angular/core';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: (): Promise<Type<unknown>> => import('./pages/home/home.component').then(module => module.HomeComponent)
  },
  {
    path: 'month',
    loadComponent: (): Promise<Type<unknown>> => import('./pages/month/month.component').then(module => module.MonthComponent)
  },
  {
    path: 'records',
    loadComponent: (): Promise<Type<unknown>> => import('./pages/records/records.component').then(module => module.RecordsComponent)
  },
  {
    path: 'stories',
    loadComponent: (): Promise<Type<unknown>> => import('./pages/stories/stories.component').then(module => module.StoriesComponent)
  },
  {
    path: 'settings',
    loadComponent: (): Promise<Type<unknown>> => import('./pages/settings/settings.component').then(module => module.SettingsComponent)
  },
  {
    path: 'overlay/:type/:ruleId',
    loadComponent: (): Promise<Type<unknown>> => import('./pages/overlay/popup-overlay.component').then(module => module.PopupOverlayComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
