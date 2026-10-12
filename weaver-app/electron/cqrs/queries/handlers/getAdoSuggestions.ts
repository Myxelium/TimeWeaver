import { DataSource } from 'typeorm';

import { loggingTitle } from '../../../ado/parse';
import { AdoWorkItem } from '../../../entities/AdoWorkItem';
import { Task } from '../../../entities/Task';
import { AdoSuggestionDTO, AdoSuggestionRangeDTO } from '../../types';

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
    const ranges = readStoredRanges(item);
    const latest = ranges[ranges.length - 1];

    return {
      adoId: item.adoId,
      title: shownTitle,
      activeOn: latest?.activeOn ?? item.activeOn,
      rangeEnd: latest?.rangeEnd ?? item.rangeEnd,
      ranges,
      spentTimeIsZero: linkedHours <= 0 && titleHours <= 0 && formattedHours <= 0
    };
  });
}

function readStoredRanges(item: AdoWorkItem): AdoSuggestionRangeDTO[] {
  const parsed = parseRanges(item.ranges);

  if (parsed.length)
    return parsed;

  if (item.activeOn && item.rangeEnd)
    return [{ activeOn: item.activeOn, rangeEnd: item.rangeEnd }];

  return [];
}

function parseRanges(raw: string | null): AdoSuggestionRangeDTO[] {
  if (!raw)
    return [];

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed))
      return [];

    return parsed.flatMap(entry => {
      if (!entry || typeof entry !== 'object')
        return [];

      const range = entry as { activeOn?: unknown; rangeEnd?: unknown };

      if (typeof range.activeOn !== 'string' || typeof range.rangeEnd !== 'string')
        return [];

      return [{ activeOn: range.activeOn, rangeEnd: range.rangeEnd }];
    });
  } catch {
    return [];
  }
}
