import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { DatabaseService } from '../../shared/services/database.service';
import { SettingsActions, loadSettings } from './settings.actions';
import { catchError, map, mergeMap, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SettingsEffects {
  load$ = createEffect(() => this.actions$.pipe(
    ofType(loadSettings),
    mergeMap(() => this.db.getSettings().pipe(
      map(settings => SettingsActions.loadSuccess({ settings })),
      catchError(err => of(SettingsActions.loadFailure({ error: err.message || 'Load settings failed' })))
    ))
  ));

  save$ = createEffect(() => this.actions$.pipe(
    ofType(SettingsActions.save),
    mergeMap(({ settings }) => this.db.saveSettings(settings).pipe(
      mergeMap(() => this.db.getSettings().pipe(map(freshSettings => SettingsActions.saveSuccess({ settings: freshSettings })))),
      catchError(err => of(SettingsActions.saveFailure({ error: err.message || 'Save settings failed' })))
    ))
  ));

  importCsv$ = createEffect(() => this.actions$.pipe(
    ofType(SettingsActions.importCsv),
    mergeMap(({ content, overwrite }) => this.db.importCsv(content, overwrite).pipe(
      map(result => SettingsActions.importCsvSuccess({ result })),
      catchError(err => of(SettingsActions.importCsvFailure({ error: err.message || 'Import CSV failed' })))
    ))
  ));

  theme$ = createEffect(() => this.actions$.pipe(
    ofType(SettingsActions.loadSuccess, SettingsActions.saveSuccess, SettingsActions.applyTheme),
    tap(action => {
      let darkMode: boolean | undefined;

      if ('settings' in action) {
        darkMode = (action as { settings: { darkMode: boolean } }).settings.darkMode;
      } else if ('darkMode' in action) {
        darkMode = (action as { darkMode: boolean }).darkMode;
      }

      const root = document.documentElement;

      root.classList.toggle('dark', !!darkMode);
    })
  ), { dispatch: false });
  constructor(private actions$: Actions, private db: DatabaseService) {}
}
