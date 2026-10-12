import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import {
  FormArray,
  FormGroup,
  ReactiveFormsModule
} from '@angular/forms';

@Component({
  selector: 'app-settings-popups',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './settings-popups.component.html'
})
export class SettingsPopupsComponent {
  @Input({ required: true }) form!: FormGroup;

  @Input() weekdayOptions: { value: number; label: string }[] = [];

  @Output() removeRule = new EventEmitter<number>();
  @Output() toggleDay = new EventEmitter<{ index: number; day: number }>();
  @Output() addRule = new EventEmitter<void>();

  get popupRules(): FormArray<FormGroup> {
    return this.form.get('popupRules') as FormArray<FormGroup>;
  }

  weekdaySelected(index: number, day: number): boolean {
    const weekdays = this.popupRules.at(index).get('weekdays')?.value as number[] | null;

    return !!weekdays?.includes(day);
  }
}
