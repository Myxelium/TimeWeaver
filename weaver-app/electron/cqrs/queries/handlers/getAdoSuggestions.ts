import { DataSource } from 'typeorm';

import {
  loggingTitle,
  timeGapFor,
  workItemIdFromTitle
} from '../../../ado/parse';
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
  const titleCount = new Map<string, number>();

  for (const item of items) {
    const title = item.title.trim();

    titleCount.set(title, (titleCount.get(title) ?? 0) + 1);
  }

  return items.map(item => toSuggestion(item, tasks, titleCount));
}

function toSuggestion(item: AdoWorkItem, tasks: Task[], titleCount: Map<string, number>): AdoSuggestionDTO {
  const title = item.title.trim();
  const shownTitle = loggingTitle(item.adoId, title);
  const loggedHours = loggedHoursFor(item, tasks, titleCount, shownTitle);
  const ranges = readStoredRanges(item);
  const latest = ranges[ranges.length - 1];
  const completedWork = readCompletedWork(item.completedWork);

  return {
    adoId: item.adoId,
    title: shownTitle,
    activeOn: latest?.activeOn ?? item.activeOn,
    rangeEnd: latest?.rangeEnd ?? item.rangeEnd,
    ranges,
    spentTimeIsZero: loggedHours <= 0,
    workItemType: item.workItemType ?? '',
    state: item.state ?? '',
    completedWork,
    loggedHours,
    timeGap: timeGapFor(item.state ?? '', completedWork, loggedHours)
  };
}

function loggedHoursFor(item: AdoWorkItem, tasks: Task[], titleCount: Map<string, number>, shownTitle: string): number {
  const title = item.title.trim();
  const titleIsUnique = (titleCount.get(title) ?? 0) === 1;

  let total = 0;

  for (const task of tasks) {
    const taskTitle = task.title?.trim() ?? '';
    const linked = task.adoWorkItemId === item.adoId;
    const sameTitle = titleIsUnique && taskTitle === title;
    const formatted = taskTitle === shownTitle;
    const sameHashtag = workItemIdFromTitle(taskTitle) === item.adoId;

    if (!linked && !sameTitle && !formatted && !sameHashtag)
      continue;

    total += Number(task.hours) || 0;
  }

  return Math.round(total * 100) / 100;
}

function readCompletedWork(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value;

  if (typeof value !== 'string' || !value.trim())
    return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
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
