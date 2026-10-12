import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(module => module.HomeComponent)
  },
  {
    path: 'month',
    loadComponent: () => import('./pages/month/month.component').then(module => module.MonthComponent)
  },
  {
    path: 'records',
    loadComponent: () => import('./pages/records/records.component').then(module => module.RecordsComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(module => module.SettingsComponent)
  },
  {
    path: 'overlay/:type/:ruleId',
    loadComponent: () => import('./pages/overlay/popup-overlay.component').then(module => module.PopupOverlayComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
