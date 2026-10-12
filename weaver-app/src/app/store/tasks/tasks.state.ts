import {
  AdoSuggestion,
  DaySummary,
  Task
} from '../../shared/models';

export interface TasksState {
  currentDate: string;
  selectedMonth: { year: number; month: number };
  todayTasks: Task[];
  monthlyData: DaySummary[];
  allTasks: Task[];
  adoSuggestions: AdoSuggestion[];
  monthlySummary: number;
  isLoading: boolean;
  error: string | null;
}

export const initialTasksState: TasksState = {
  currentDate: new Date().toISOString()
    .split('T')[0],
  selectedMonth: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
  todayTasks: [],
  monthlyData: [],
  allTasks: [],
  adoSuggestions: [],
  monthlySummary: 0,
  isLoading: false,
  error: null
};
