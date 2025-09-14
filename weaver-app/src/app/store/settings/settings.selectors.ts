import { createFeatureSelector, createSelector } from '@ngrx/store';
import { settingsFeatureKey, SettingsState } from './settings.reducer';

export const selectSettingsState = createFeatureSelector<SettingsState>(settingsFeatureKey);
export const selectSettings = createSelector(selectSettingsState, s => s.settings);
export const selectDarkMode = createSelector(selectSettings, s => s?.darkMode ?? false);
export const selectIgnoreWeekends = createSelector(selectSettings, s => s?.ignoreWeekends ?? true);
export const selectMonthlyIncome = createSelector(selectSettings, s => s?.monthlyIncome ?? 0);
export const selectMonthlyCost = createSelector(selectSettings, s => s?.monthlyCost ?? 0);
export const selectLastSaveSuccessAt = createSelector(selectSettingsState, s => s.lastSaveSuccessAt);
export const selectLastImportResult = createSelector(selectSettingsState, s => s.lastImportResult);
