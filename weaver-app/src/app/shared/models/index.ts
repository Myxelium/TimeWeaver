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

export interface Settings {
  monthlyIncome: number;
  monthlyCost: number;
  darkMode: boolean;
  ignoreWeekends: boolean;
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
