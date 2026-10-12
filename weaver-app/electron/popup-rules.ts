export type PopupRuleType = 'time-log' | 'reminder';

export interface PopupRule {
  id: string;
  enabled: boolean;
  type: PopupRuleType;
  time: string;
  weekdays: number[];
  message: string;
  durationSeconds: number;
  intervalMinutes: number;
  onlyIfNothingReported: boolean;
  lastResolvedDate: string | null;
  lastTriggeredAt: string | null;
}

const MAX_INTERVAL_MINUTES = 1440;
const MAX_MESSAGE_LENGTH = 500;
const MAX_DURATION_SECONDS = 86400;
const DEFAULT_DURATION_SECONDS = 30;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const WEDNESDAY = 3;
const THURSDAY = 4;
const FRIDAY = 5;
const SATURDAY = 6;
const DEFAULT_WEEKDAYS = [
  1,
  2,
  WEDNESDAY,
  THURSDAY,
  FRIDAY
];
const TIME_PATTERN = /^(\d{2}):(\d{2})/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parsePopupRules(raw: unknown): PopupRule[] {
  let value = raw;

  if (typeof raw === 'string') {
    if (!raw.trim())
      return [];

    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value))
    return [];

  const rules: PopupRule[] = [];

  for (const item of value) {
    const rule = normalizePopupRule(item);

    if (rule)
      rules.push(rule);
  }

  return rules;
}

export function mergePopupRules(existingRaw: string | null | undefined, incoming: unknown): PopupRule[] {
  const existing = parsePopupRules(existingRaw ?? '[]');
  const incomingRules = parsePopupRules(incoming);

  return incomingRules.map(rule => {
    const previous = existing.find(item => item.id === rule.id);

    return {
      ...rule,
      lastResolvedDate: laterDate(previous?.lastResolvedDate, rule.lastResolvedDate),
      lastTriggeredAt: laterTimestamp(previous?.lastTriggeredAt, rule.lastTriggeredAt)
    };
  });
}

export function dailyTargetHours(maxHoursEnabled: boolean, maxHoursPerDay: number): number {
  const dailyWorkHours = 8;

  if (maxHoursEnabled && maxHoursPerDay < dailyWorkHours)
    return roundHours(maxHoursPerDay);

  return dailyWorkHours;
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizePopupRule(item: unknown): PopupRule | null {
  if (!item || typeof item !== 'object')
    return null;

  const source = item as Record<string, unknown>;
  const id = typeof source['id'] === 'string' ? source['id'].trim() : '';

  if (!id)
    return null;

  const type: PopupRuleType = source['type'] === 'reminder' ? 'reminder' : 'time-log';
  const weekdays = normalizeWeekdays(source['weekdays']);
  const duration = Number(source['durationSeconds']);
  const interval = Number(source['intervalMinutes']);
  const lastResolvedDate = typeof source['lastResolvedDate'] === 'string' && DATE_PATTERN.test(source['lastResolvedDate'])
    ? source['lastResolvedDate']
    : null;

  return {
    id,
    enabled: source['enabled'] === true,
    type,
    time: normalizeTime(source['time']),
    weekdays,
    message: typeof source['message'] === 'string' ? source['message'].slice(0, MAX_MESSAGE_LENGTH) : '',
    durationSeconds: Number.isFinite(duration) ? Math.min(MAX_DURATION_SECONDS, Math.max(1, Math.round(duration))) : DEFAULT_DURATION_SECONDS,
    intervalMinutes: normalizeInterval(interval),
    onlyIfNothingReported: source['onlyIfNothingReported'] === true,
    lastResolvedDate,
    lastTriggeredAt: normalizeTimestamp(source['lastTriggeredAt'])
  };
}

function normalizeTime(value: unknown): string {
  const match = typeof value === 'string' ? TIME_PATTERN.exec(value) : null;

  if (!match)
    return '17:00';

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > MAX_HOUR || minutes > MAX_MINUTE)
    return '17:00';

  return `${match[1]}:${match[2]}`;
}

function normalizeWeekdays(value: unknown): number[] {
  if (!Array.isArray(value))
    return DEFAULT_WEEKDAYS;

  const days = value
    .map(day => Number(day))
    .filter(day => Number.isInteger(day) && day >= 0 && day <= SATURDAY);

  return [...new Set(days)];
}

function normalizeInterval(interval: number): number {
  if (!Number.isFinite(interval) || interval <= 0)
    return 0;

  return Math.min(MAX_INTERVAL_MINUTES, Math.round(interval));
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim())
    return null;

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed))
    return null;

  return new Date(parsed).toISOString();
}

function laterTimestamp(left: string | null | undefined, right: string | null | undefined): string | null {
  const first = left ?? '';
  const second = right ?? '';

  if (!first && !second)
    return null;

  return first > second ? first : second;
}

function laterDate(left: string | null | undefined, right: string | null | undefined): string | null {
  const first = left ?? '';
  const second = right ?? '';

  if (!first && !second)
    return null;

  return first > second ? first : second;
}
