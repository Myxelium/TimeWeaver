export interface Task {
  id?: number;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD format
  hours: number;
  created_at?: string;
  updated_at?: string;
}

export interface DaySummary {
  date: string;
  total_hours: number;
  task_count: number;
  tasks?: Task[];
}

export interface MonthlySummary {
  year: number;
  month: number;
  total_hours: number;
  working_days: number;
  days: DaySummary[];
}

export interface TimeEntry {
  id?: number;
  task_id?: number;
  date: string;
  hours: number;
  created_at?: string;
}

export interface NavItem {
  path: string;
  icon: string;
  label: string;
  title: string;
}

export interface AppState {
  currentDate: string;
  selectedMonth: { year: number; month: number };
  todayTasks: Task[];
  monthlyData: DaySummary[];
  allTasks: Task[];
  monthlySummary: number;
  isLoading: boolean;
  error: string | null;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  date: string;
  hours?: number;
}

export interface UpdateTaskRequest extends CreateTaskRequest {
  id: number;
}

// Holiday types supported by date-holidays library
export type HolidayType = 'public' | 'bank' | 'school' | 'optional' | 'observance';
export const ALL_HOLIDAY_TYPES: HolidayType[] = [
  'public',
  'bank',
  'school',
  'optional',
  'observance'
];
export const DEFAULT_HOLIDAY_TYPES: HolidayType[] = ['public', 'bank'];

export type PopupRuleType = 'time-log' | 'reminder';

export interface PopupRule {
  id: string;
  enabled: boolean;
  type: PopupRuleType;
  time: string; // HH:mm
  weekdays: number[]; // 0=Sunday ... 6=Saturday
  message: string;
  durationSeconds: number;
  intervalMinutes?: number; // 0 shows once at `time`; otherwise minutes after the popup is closed
  onlyIfNothingReported?: boolean;
  lastResolvedDate?: string | null;
  lastTriggeredAt?: string | null;
}

export interface PopupEntry {
  title: string;
  hours: number;
}

export interface PopupContext {
  ruleId: string;
  type: PopupRuleType;
  message: string;
  durationSeconds: number;
  darkMode: boolean;
  today: string;
  previousDate: string | null;
  targetHours: number;
  todayHours: number;
  remainingHours: number;
  previousTitles: string[];
  recentTitles: string[];
}

export interface Settings {
  monthlyIncome: number;
  monthlyCost: number;
  darkMode: boolean;
  ignoreWeekends: boolean;
  maxHoursPerDay: number;
  maxHoursEnabled: boolean;
  holidayCountry?: string; // ISO-3166-1 alpha-2, e.g., SE
  holidayTypes?: HolidayType[]; // Which holiday types to show in calendar
  firstDayOfWeek?: number; // 0=Sunday ... 6=Saturday; default 1 (Monday)
  overtimeRate?: number; // Overtime income rate (default 0)
  launchAtLogin?: boolean;
  popupRules?: PopupRule[];
}

export const DAILY_WORK_HOURS = 8;

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    icon: 'home',
    label: 'Home',
    title: 'Today\'s Tasks'
  },
  {
    path: '/month',
    icon: 'calendar',
    label: 'Month',
    title: 'Monthly View'
  },
  {
    path: '/records',
    icon: 'archive',
    label: 'Records',
    title: 'All Records'
  }
];
