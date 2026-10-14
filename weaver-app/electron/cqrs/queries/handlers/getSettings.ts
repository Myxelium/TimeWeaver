import { DataSource } from 'typeorm';

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
    adoLastSyncOn: settings.adoLastSyncOn ?? undefined,
    adoLastSyncError: settings.adoLastSyncError ?? undefined
  };
}
