import { DataSource } from 'typeorm';
import { SaveSettingsCommand } from '../../types';
import { Setting } from '../../../entities/Setting';
import { mergePopupRules } from '../../../popup-rules';

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

  await repo.save(settings);
  return true;
}
