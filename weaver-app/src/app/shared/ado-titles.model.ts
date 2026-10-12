import { AdoSuggestion, AdoSuggestionRange } from './models';

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
