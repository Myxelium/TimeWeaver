import { DataSource } from 'typeorm';
import { SaveSettingsCommand } from '../../types';
import { Setting } from '../../../entities/Setting';

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
  await repo.save(settings);
  return true;
}
