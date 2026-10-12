import {
  createActionGroup,
  props,
  createAction
} from '@ngrx/store';
import { Settings } from '../../shared/models';

export const SettingsActions = createActionGroup({
  source: 'Settings',
  events: {
    'Load Success': props<{ settings: Settings }>(),
    'Load Failure': props<{ error: string }>(),
    'Save': props<{ settings: Settings }>(),
    'Save Success': props<{ settings: Settings }>(),
    'Save Failure': props<{ error: string }>(),
    'Apply Theme': props<{ darkMode: boolean }>(),
    'Import Csv': props<{ content: string; overwrite: boolean }>(),
    'Import Csv Success': props<{ result: { imported: number; updated: number; skipped: number; total: number } }>(),
    'Import Csv Failure': props<{ error: string }>()
  }
});

export const loadSettings = createAction('[Settings] Load');
