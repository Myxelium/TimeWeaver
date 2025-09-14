import { createActionGroup, props, createAction } from '@ngrx/store';
import { Settings } from '../../shared/models';

export const SettingsActions = createActionGroup({
  source: 'Settings',
  events: {
    'Load Success': props<{ settings: Settings }>(),
    'Load Failure': props<{ error: string }>(),
    'Save': props<{ settings: Settings }>(),
    'Save Success': props<{ settings: Settings }>(),
    'Save Failure': props<{ error: string }>(),
    'Apply Theme': props<{ darkMode: boolean }>()
  }
});

export const loadSettings = createAction('[Settings] Load');
