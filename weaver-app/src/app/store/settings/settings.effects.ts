import { inject, Injectable } from '@angular/core';
import {
  Actions,
  createEffect,
  ofType
} from '@ngrx/effects';
import {
  catchError,
  EMPTY,
  map,
  mergeMap,
  of,
  tap
} from 'rxjs';

import { HolidayService } from '../../shared/services';
import { DatabaseService } from '../../shared/services/database.service';
import { loadSettings, SettingsActions } from './settings.actions';

@Injectable({ providedIn: 'root' })
export class SettingsEffects {
  private actions$ = inject(Actions);
  private db = inject(DatabaseService);
  private holidayService = inject(HolidayService);

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

  // Auto-detect holiday country if missing on first load
  ensureHolidayCountry$ = createEffect(() => this.actions$.pipe(
    ofType(SettingsActions.loadSuccess),
    mergeMap(({ settings }) => {
      if (!settings.holidayCountry || settings.holidayCountry.length !== 2) {
        const cc = this.holidayService.detectCountryCode();

        return of(SettingsActions.save({ settings: { ...settings, holidayCountry: cc } }));
      }

      return EMPTY;
    })
  ));
}
