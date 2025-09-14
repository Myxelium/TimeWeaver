import { createReducer, on } from '@ngrx/store';
import { Settings } from '../../shared/models';
import { SettingsActions } from './settings.actions';
import { loadSettings } from './settings.actions';

export interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
}

export const initialSettingsState: SettingsState = {
  settings: null,
  loading: false,
  error: null
};

export const settingsFeatureKey = 'settings';

export const settingsReducer = createReducer(
  initialSettingsState,
  on(loadSettings, state => ({ ...state, loading: true, error: null })),
  on(SettingsActions.loadSuccess, (state, { settings }) => ({ ...state, settings, loading: false })),
  on(SettingsActions.loadFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(SettingsActions.save, state => ({ ...state, loading: true })),
  on(SettingsActions.saveSuccess, (state, { settings }) => ({ ...state, settings, loading: false })),
  on(SettingsActions.saveFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(SettingsActions.applyTheme, (state, { darkMode }) => ({
    ...state,
    settings: state.settings ? { ...state.settings, darkMode } : { monthlyIncome: 0, monthlyCost: 0, darkMode, ignoreWeekends: true }
  }))
);
