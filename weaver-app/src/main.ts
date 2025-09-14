import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { provideStore } from '@ngrx/store';
import { tasksReducer, tasksFeatureKey } from './app/store/tasks/tasks.reducer';
import { provideEffects } from '@ngrx/effects';
import { TasksEffects } from './app/store/tasks/tasks.effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideStore({ [tasksFeatureKey]: tasksReducer }),
    provideEffects([TasksEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: false })
  ]
});
