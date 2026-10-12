import 'zone.js';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { SettingsEffects } from './app/store/settings/settings.effects';
import { settingsFeatureKey, settingsReducer } from './app/store/settings/settings.reducer';
import { TasksEffects } from './app/store/tasks/tasks.effects';
import { tasksFeatureKey, tasksReducer } from './app/store/tasks/tasks.reducer';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideStore({ [tasksFeatureKey]: tasksReducer, [settingsFeatureKey]: settingsReducer }),
    provideEffects([TasksEffects, SettingsEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: false })
  ]
});
