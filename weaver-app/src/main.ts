import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { provideStore } from '@ngrx/store';
import { tasksReducer, tasksFeatureKey } from './app/store/tasks/tasks.reducer';
import { settingsReducer, settingsFeatureKey } from './app/store/settings/settings.reducer';
import { provideEffects } from '@ngrx/effects';
import { TasksEffects } from './app/store/tasks/tasks.effects';
import { SettingsEffects } from './app/store/settings/settings.effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideStore({ [tasksFeatureKey]: tasksReducer, [settingsFeatureKey]: settingsReducer }),
    provideEffects([TasksEffects, SettingsEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: false })
  ]
});
