import { createFeatureSelector, createSelector } from '@ngrx/store';
import { settingsFeatureKey, SettingsState } from './settings.reducer';

export const selectSettingsState = createFeatureSelector<SettingsState>(settingsFeatureKey);
export const selectSettings = createSelector(selectSettingsState, state => state.settings);
export const selectDarkMode = createSelector(selectSettings, settings => settings?.darkMode ?? false);
export const selectIgnoreWeekends = createSelector(selectSettings, settings => settings?.ignoreWeekends ?? true);
export const selectMonthlyIncome = createSelector(selectSettings, settings => settings?.monthlyIncome ?? 0);
export const selectMonthlyCost = createSelector(selectSettings, settings => settings?.monthlyCost ?? 0);
export const selectLastSaveSuccessAt = createSelector(selectSettingsState, state => state.lastSaveSuccessAt);
export const selectLastImportResult = createSelector(selectSettingsState, state => state.lastImportResult);
