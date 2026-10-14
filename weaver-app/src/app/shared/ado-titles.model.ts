import { AdoSuggestion, AdoSuggestionRange } from './models';

const ORGANIZATION_NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/;
const ORGANIZATION_URL = /^https:\/\/dev\.azure\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,62})(?:\/|$)/i;
const PREFIXED_WORK_ITEM = /^#(\d+)(\s[\s\S]*)?$/;

export function syncedWorkItemId(
  title: string,
  adoWorkItemId: number | null | undefined,
  suggestions: AdoSuggestion[]
): number | null {
  if (adoWorkItemId != null && adoWorkItemId > 0)
    return adoWorkItemId;

  const trimmed = title.trim();
  const match = suggestions.find(item => {
    const suggestionTitle = item.title.trim();

    return suggestionTitle === trimmed
      || trimmed === `#${item.adoId}`
      || trimmed.startsWith(`#${item.adoId} `);
  });

  return match?.adoId ?? null;
}

export function organizationSlug(organization: string | undefined): string | null {
  if (!organization)
    return null;

  const trimmed = organization.trim().replace(/\/+$/, '');
  const fromUrl = ORGANIZATION_URL.exec(trimmed);
  const name = fromUrl ? fromUrl[1] : trimmed;

  if (!ORGANIZATION_NAME.test(name))
    return null;

  return name;
}

export function workItemPageUrl(organization: string | undefined, adoId: number | null | undefined): string | null {
  const slug = organizationSlug(organization);

  if (!slug || adoId == null || adoId <= 0)
    return null;

  return `https://dev.azure.com/${encodeURIComponent(slug)}/_workitems/edit/${adoId}`;
}

export function syncedTitleParts(
  title: string,
  adoId: number
): { idLabel: string; rest: string } {
  const trimmed = title.trim();
  const prefixed = PREFIXED_WORK_ITEM.exec(trimmed);

  if (prefixed && Number(prefixed[1]) === adoId)
    return { idLabel: `#${adoId}`, rest: prefixed[2] ?? '' };

  return { idLabel: `#${adoId}`, rest: trimmed ? ` ${trimmed}` : '' };
}

export function suggestionRanges(item: AdoSuggestion): AdoSuggestionRange[] {
  if (item.ranges?.length)
    return item.ranges;

  if (item.activeOn && item.rangeEnd)
    return [{ activeOn: item.activeOn, rangeEnd: item.rangeEnd }];

  return [];
}

export function suggestionsOnDay(suggestions: AdoSuggestion[], dayKey: string): AdoSuggestion[] {
  return suggestions.filter(item => suggestionRanges(item).some(range =>
    range.activeOn <= dayKey && dayKey <= range.rangeEnd
  ));
}

export function titlesForLogging(taskTitles: string[], suggestions: AdoSuggestion[]): string[] {
  const unreported = suggestions
    .filter(item => item.spentTimeIsZero)
    .map(item => item.title.trim())
    .filter(title => title.length > 0);
  const titles: string[] = [];

  for (const title of [...unreported, ...taskTitles]) {
    if (title && !titles.includes(title))
      titles.push(title);
  }

  return titles;
}
