import { DataSource } from 'typeorm';

import { loggingTitle } from '../../../ado/parse';
import { AdoWorkItem } from '../../../entities/AdoWorkItem';
import { Task } from '../../../entities/Task';
import { AdoSuggestionDTO } from '../../types';

export async function handleGetAdoSuggestions(dataSource: DataSource): Promise<AdoSuggestionDTO[]> {
  const items = await dataSource.getRepository(AdoWorkItem).find({ order: { adoId: 'ASC' } });
  const tasks = await dataSource.getRepository(Task).find({
    select: {
      id: true,
      title: true,
      hours: true,
      adoWorkItemId: true
    }
  });
  const hoursById = new Map<number, number>();
  const hoursByTitle = new Map<string, number>();
  const titleCount = new Map<string, number>();

  for (const item of items) {
    const title = item.title.trim();

    titleCount.set(title, (titleCount.get(title) ?? 0) + 1);
  }

  for (const task of tasks) {
    const hours = Number(task.hours) || 0;
    const title = task.title?.trim() ?? '';

    if (task.adoWorkItemId != null)
      hoursById.set(task.adoWorkItemId, (hoursById.get(task.adoWorkItemId) ?? 0) + hours);

    if (title)
      hoursByTitle.set(title, (hoursByTitle.get(title) ?? 0) + hours);
  }

  return items.map(item => {
    const title = item.title.trim();
    const shownTitle = loggingTitle(item.adoId, title);
    const linkedHours = hoursById.get(item.adoId) ?? 0;
    const titleHours = (titleCount.get(title) ?? 0) === 1 ? (hoursByTitle.get(title) ?? 0) : 0;
    const formattedHours = hoursByTitle.get(shownTitle) ?? 0;

    return {
      adoId: item.adoId,
      title: shownTitle,
      activeOn: item.activeOn,
      rangeEnd: item.rangeEnd,
      spentTimeIsZero: linkedHours <= 0 && titleHours <= 0 && formattedHours <= 0
    };
  });
}
