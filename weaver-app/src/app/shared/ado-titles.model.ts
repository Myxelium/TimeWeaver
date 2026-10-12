import { AdoSuggestion } from './models';

export function suggestionsOnDay(suggestions: AdoSuggestion[], dayKey: string): AdoSuggestion[] {
  return suggestions.filter(item =>
    !!item.activeOn && !!item.rangeEnd && item.activeOn <= dayKey && dayKey <= item.rangeEnd
  );
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
