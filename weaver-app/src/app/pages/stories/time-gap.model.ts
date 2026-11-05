import { AdoSuggestion, AdoTimeGap } from '../../shared/models';

export function timeGapsToFill(suggestions: AdoSuggestion[]): AdoSuggestion[] {
  return suggestions
    .filter(needsTime)
    .sort((left, right) => gapRank(left.timeGap) - gapRank(right.timeGap) || right.adoId - left.adoId);
}

export function timeGapLabel(gap: AdoTimeGap): string {
  return gap === 'missing' ? 'No time spent' : 'Mismatch';
}

function needsTime(item: AdoSuggestion): item is AdoSuggestion & { timeGap: AdoTimeGap } {
  return item.timeGap === 'missing' || item.timeGap === 'mismatch';
}

function gapRank(gap: AdoTimeGap | null): number {
  return gap === 'missing' ? 0 : 1;
}
