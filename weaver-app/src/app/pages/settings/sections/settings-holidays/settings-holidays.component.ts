import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { HolidayType } from '../../../../shared/models';

@Component({
  selector: 'app-settings-holidays',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './settings-holidays.component.html'
})
export class SettingsHolidaysComponent {
  @Input({ required: true }) form!: FormGroup;

  @Input() holidayTypeOptions: { type: HolidayType; label: string; description: string }[] = [];

  @Output() detectCountry = new EventEmitter<void>();
  @Output() toggleType = new EventEmitter<HolidayType>();

  holidayTypeEnabled(type: HolidayType): boolean {
    const types = (this.form.get('holidayTypes')?.value ?? []) as HolidayType[];

    return types.includes(type);
  }
}
