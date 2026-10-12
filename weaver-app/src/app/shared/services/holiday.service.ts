import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import Holidays from 'date-holidays';

import { selectSettings } from '../../store/settings/settings.selectors';
import { DEFAULT_HOLIDAY_TYPES, HolidayType } from '../models';

export interface HolidayInfo {
  isHoliday: boolean;
  name?: string;
  type?: string;
  isBank?: boolean;
}

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private holiday: Holidays | null = null;
  private countryCode: string | null = null; // ISO-3166-1 alpha-2

  private store = inject(Store);

  private settingsSignal = toSignal(this.store.select(selectSettings), { initialValue: null });

  detectCountryCode(): string {
    const loc = (Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || 'en-SE');
    const match = /[-_](?<cc>[A-Z]{2})/.exec(loc);
    const cc = (match?.groups as Record<string, string> | undefined)?.['cc'] || 'SE';

    return cc.toUpperCase();
  }

  getHolidayInfo(date: Date): HolidayInfo {
    this.ensureInit();

    if (!this.holiday)
      return { isHoliday: false };

    const res = this.holiday.isHoliday(date as Date) as unknown;

    if (!res)
      return { isHoliday: false };

    const items = (Array.isArray(res) ? res : [res]) as { name?: string; type?: string }[];
    // Get enabled holiday types from settings
    const settings = this.settingsSignal();
    const enabledTypes = (settings as { holidayTypes?: HolidayType[] } | null)?.holidayTypes || DEFAULT_HOLIDAY_TYPES;
    // Filter items by enabled types
    const matchingItems = items.filter(item => {
      const itemType = (item.type || '').toLowerCase() as HolidayType;

      return enabledTypes.includes(itemType);
    });

    if (matchingItems.length === 0)
      return { isHoliday: false };

    const name = matchingItems[0]?.name;
    const type = matchingItems[0]?.type;
    const isBank = matchingItems.some(item => (item.type || '').toLowerCase() === 'bank' || (item.type || '').toLowerCase() === 'optional');

    return { isHoliday: true, name, type, isBank };
  }

  getHolidayName(date: Date): string | null {
    const info = this.getHolidayInfo(date);

    return info.isHoliday ? (info.name || 'Holiday') : null;
  }

  private ensureInit(): void {
    const settings = this.settingsSignal();
    const code = (settings as { holidayCountry?: string } | null)?.holidayCountry || this.detectCountryCode();

    if (this.countryCode !== code) {
      this.countryCode = code;

      try {
        this.holiday = new Holidays(code || 'SE');
      } catch {
        // fallback
        this.holiday = new Holidays('SE');
        this.countryCode = 'SE';
      }
    }
  }
}
