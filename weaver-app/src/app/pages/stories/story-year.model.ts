import { suggestionRanges } from '../../shared/ado-titles.model';
import {
  AdoSuggestion,
  AdoSuggestionRange,
  Task
} from '../../shared/models';

export interface StoryYearBar {
  activeOn: string;
  rangeEnd: string;
  left: number;
  width: number;
}

export interface StoryYearRow {
  adoId: number;
  title: string;
  started: string;
  ended: string;
  days: number;
  hours: number;
  bars: StoryYearBar[];
}

const MILLISECONDS_PER_DAY = 86_400_000;
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

export function monthLabels(): string[] {
  return MONTH_LABELS;
}

export function storyRowsForYear(suggestions: AdoSuggestion[], tasks: Task[], year: number): StoryYearRow[] {
  const rows: StoryYearRow[] = [];

  for (const suggestion of suggestions) {
    const ranges = suggestionRanges(suggestion).filter(range => overlapsYear(range, year));

    if (!ranges.length)
      continue;

    const bars = ranges.flatMap(range => barForRange(range, year));
    const started = ranges.map(range => range.activeOn).sort()[0];
    const ended = ranges.map(range => range.rangeEnd).sort()
      .at(-1) ?? started;

    rows.push({
      adoId: suggestion.adoId,
      title: suggestion.title.trim(),
      started,
      ended,
      days: ranges.reduce((sum, range) => sum + daysInsideYear(range, year), 0),
      hours: hoursInYear(tasks, suggestion, year),
      bars
    });
  }

  return rows.sort((left, right) => left.started.localeCompare(right.started) || left.title.localeCompare(right.title));
}

function overlapsYear(range: AdoSuggestionRange, year: number): boolean {
  return range.activeOn <= yearEnd(year) && range.rangeEnd >= yearStart(year);
}

function barForRange(range: AdoSuggestionRange, year: number): StoryYearBar[] {
  const clipped = clipToYear(range, year);

  if (!clipped)
    return [];

  const total = daysInYear(year);
  const startIndex = dayIndex(clipped.activeOn, year);
  const endIndex = dayIndex(clipped.rangeEnd, year);
  const left = (startIndex / total) * 100;
  const width = ((endIndex - startIndex + 1) / total) * 100;

  return [
    {
      activeOn: range.activeOn,
      rangeEnd: range.rangeEnd,
      left,
      width: Math.min(width, 100 - left)
    }
  ];
}

function daysInsideYear(range: AdoSuggestionRange, year: number): number {
  const clipped = clipToYear(range, year);

  if (!clipped)
    return 0;

  return dayIndex(clipped.rangeEnd, year) - dayIndex(clipped.activeOn, year) + 1;
}

function hoursInYear(tasks: Task[], suggestion: AdoSuggestion, year: number): number {
  const title = suggestion.title.trim();
  const prefix = `${year}-`;

  let total = 0;

  for (const task of tasks) {
    const sameStory = task.adoWorkItemId === suggestion.adoId || task.title.trim() === title;

    if (!task.date.startsWith(prefix) || !sameStory)
      continue;

    total += Number(task.hours) || 0;
  }

  return Math.round(total * 10) / 10;
}

function clipToYear(range: AdoSuggestionRange, year: number): AdoSuggestionRange | null {
  if (!overlapsYear(range, year))
    return null;

  const activeOn = range.activeOn < yearStart(year) ? yearStart(year) : range.activeOn;
  const rangeEnd = range.rangeEnd > yearEnd(year) ? yearEnd(year) : range.rangeEnd;

  return { activeOn, rangeEnd };
}

function yearStart(year: number): string {
  return `${year}-01-01`;
}

function yearEnd(year: number): string {
  return `${year}-12-31`;
}

function daysInYear(year: number): number {
  return dayIndex(yearEnd(year), year) + 1;
}

function dayIndex(day: string, year: number): number {
  const [
    dayYear,
    month,
    date
  ] = day.split('-').map(Number);
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(dayYear, month - 1, date);

  return Math.round((current - start) / MILLISECONDS_PER_DAY);
}
