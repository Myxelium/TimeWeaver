import { createReducer, on } from '@ngrx/store';
import { Settings } from '../../shared/models';
import { SettingsActions } from './settings.actions';
import { loadSettings } from './settings.actions';

export interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  lastSaveSuccessAt?: number;
  lastImportResult?: { imported: number; updated: number; skipped: number; total: number } | null;
}

export const initialSettingsState: SettingsState = {
  settings: null,
  loading: false,
  error: null,
  lastSaveSuccessAt: undefined,
  lastImportResult: null
};

export const settingsFeatureKey = 'settings';

export const settingsReducer = createReducer(
  initialSettingsState,
  on(loadSettings, state => ({ ...state, loading: true, error: null })),
  on(SettingsActions.loadSuccess, (state, { settings }) => ({ ...state, settings, loading: false })),
  on(SettingsActions.loadFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(SettingsActions.save, state => ({ ...state, loading: true })),
  on(SettingsActions.saveSuccess, (state, { settings }) => ({ ...state, settings, loading: false, lastSaveSuccessAt: Date.now() })),
  on(SettingsActions.saveFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(SettingsActions.importCsv, state => ({ ...state, loading: true, error: null, lastImportResult: null })),
  on(SettingsActions.importCsvSuccess, (state, { result }) => ({ ...state, loading: false, lastImportResult: result })),
  on(SettingsActions.importCsvFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(SettingsActions.applyTheme, (state, { darkMode }) => ({
    ...state,
    settings: state.settings
      ? { ...state.settings, darkMode }
      : { monthlyIncome: 0, monthlyCost: 0, darkMode, ignoreWeekends: true, maxHoursPerDay: 8, maxHoursEnabled: true }
  }))
);
