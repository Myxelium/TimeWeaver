import { DataSource } from 'typeorm';

import { organizationName } from '../../../ado/parse';
import { Setting } from '../../../entities/Setting';
import { mergePopupRules } from '../../../popup-rules';
import { SaveSettingsCommand } from '../../types';

export async function handleSaveSettings(command: SaveSettingsCommand, dataSource: DataSource): Promise<boolean> {
  const repo = dataSource.getRepository(Setting);

  let settings = await repo.findOne({ where: { id: 1 } });

  if (!settings) {
    settings = repo.create({ id: 1 });
  }

  settings.monthlyIncome = command.payload.monthlyIncome;
  settings.monthlyCost = command.payload.monthlyCost;
  settings.darkMode = command.payload.darkMode;
  settings.ignoreWeekends = command.payload.ignoreWeekends;

  if (typeof command.payload.skipWeekendsOnSelect === 'boolean')
    settings.skipWeekendsOnSelect = command.payload.skipWeekendsOnSelect;

  if (typeof command.payload.skipHolidaysOnSelect === 'boolean')
    settings.skipHolidaysOnSelect = command.payload.skipHolidaysOnSelect;

  settings.maxHoursPerDay = command.payload.maxHoursPerDay;
  settings.maxHoursEnabled = command.payload.maxHoursEnabled;
  settings.holidayCountry = command.payload.holidayCountry ?? null;

  if (Array.isArray(command.payload.holidayTypes))
    settings.holidayTypes = command.payload.holidayTypes.join(',');

  if (typeof command.payload.firstDayOfWeek === 'number')
    settings.firstDayOfWeek = command.payload.firstDayOfWeek;

  if (typeof command.payload.overtimeRate === 'number')
    settings.overtimeRate = command.payload.overtimeRate;

  if (typeof command.payload.launchAtLogin === 'boolean')
    settings.launchAtLogin = command.payload.launchAtLogin;

  if (Array.isArray(command.payload.popupRules)) {
    const merged = mergePopupRules(settings.popupRules, command.payload.popupRules);

    settings.popupRules = JSON.stringify(merged);
  }

  if (typeof command.payload.adoOrganization === 'string') {
    const organization = command.payload.adoOrganization.trim();

    settings.adoOrganization = organization ? organizationName(organization) : null;
  }

  if (command.payload.clearAdoPat)
    settings.adoPat = null;
  else if (typeof command.payload.adoPat === 'string' && command.payload.adoPat.trim())
    settings.adoPat = command.payload.adoPat.trim();

  if (command.payload.adoAuthMethod === 'azure-cli' || command.payload.adoAuthMethod === 'pat')
    settings.adoAuthMethod = command.payload.adoAuthMethod;

  if (typeof command.payload.adoSyncEnabled === 'boolean')
    settings.adoSyncEnabled = command.payload.adoSyncEnabled;

  await repo.save(settings);
  return true;
}
