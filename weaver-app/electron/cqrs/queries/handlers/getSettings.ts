import { DataSource } from 'typeorm';
import { Setting } from '../../../entities/Setting';
import { SettingsDTO } from '../../types';

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
    maxHoursPerDay: settings.maxHoursPerDay ?? 8,
    maxHoursEnabled: settings.maxHoursEnabled !== false
  };
}
