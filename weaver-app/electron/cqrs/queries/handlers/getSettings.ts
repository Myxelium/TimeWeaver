import { DataSource } from 'typeorm';

import { DEFAULT_TIME_SPENT_FIELD } from '../../../ado/parse';
import { Setting } from '../../../entities/Setting';
import { parsePopupRules } from '../../../popup-rules';
import { SettingsDTO } from '../../types';

const defaultMaxHoursPerDay = 8;

export async function handleGetSettings(dataSource: DataSource): Promise<SettingsDTO> {
  const repo = dataSource.getRepository(Setting);

  let settings = await repo.findOne({ where: { id: 1 } });

  if (!settings) {
    settings = repo.create({ id: 1 });
    settings = await repo.save(settings);
  }

  return {
    monthlyIncome: settings.monthlyIncome ?? 0,
    monthlyCost: settings.monthlyCost ?? 0,
    darkMode: !!settings.darkMode,
    ignoreWeekends: settings.ignoreWeekends !== false,
    skipWeekendsOnSelect: !!settings.skipWeekendsOnSelect,
    skipHolidaysOnSelect: !!settings.skipHolidaysOnSelect,
    maxHoursPerDay: settings.maxHoursPerDay ?? defaultMaxHoursPerDay,
    maxHoursEnabled: settings.maxHoursEnabled !== false,
    holidayCountry: settings.holidayCountry ?? undefined,
    holidayTypes: settings.holidayTypes ? settings.holidayTypes.split(',').filter(Boolean) : ['public', 'bank'],
    firstDayOfWeek: settings.firstDayOfWeek ?? 1,
    overtimeRate: settings.overtimeRate ?? 0,
    launchAtLogin: !!settings.launchAtLogin,
    popupRules: parsePopupRules(settings.popupRules),
    adoOrganization: settings.adoOrganization ?? undefined,
    adoPatConfigured: !!settings.adoPat,
    adoAuthMethod: settings.adoAuthMethod === 'azure-cli' ? 'azure-cli' : 'pat',
    adoSyncEnabled: !!settings.adoSyncEnabled,
    adoTimeSpentField: settings.adoTimeSpentField?.trim() || DEFAULT_TIME_SPENT_FIELD,
    adoHideNeedsTime: !!settings.adoHideNeedsTime,
    adoIgnoreHigherAzureTime: !!settings.adoIgnoreHigherAzureTime,
    adoLastSyncOn: settings.adoLastSyncOn ?? undefined,
    adoLastSyncError: settings.adoLastSyncError ?? undefined
  };
}
