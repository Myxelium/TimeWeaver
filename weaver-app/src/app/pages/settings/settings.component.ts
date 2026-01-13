import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Settings, HolidayType, DEFAULT_HOLIDAY_TYPES } from '../../shared/models';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';
import { SettingsActions, loadSettings } from '../../store/settings/settings.actions';
import { TasksActions } from '../../store/tasks/tasks.actions';
import { selectIsLoading } from '../../store/tasks/tasks.selectors';
import { selectLastImportResult, selectSettings } from '../../store/settings/settings.selectors';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { HolidayService } from '../../shared/services';

interface SettingsFormValue {
  monthlyIncome: number | null;
  monthlyCost: number | null;
  darkMode: boolean | null;
  ignoreWeekends: boolean | null;
  maxHoursPerDay: number | null;
  maxHoursEnabled: boolean | null;
  holidayCountry: string | null;
  holidayTypes: HolidayType[] | null;
  firstDayOfWeek: number | null;
  overtimeRate: number | null;
  overwrite?: boolean | null;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  eye = Eye;
  eyeOff = EyeOff;
  settings$ = this.store.select(selectSettings);
  lastImportResult$ = this.store.select(selectLastImportResult);
  isLoading$ = this.store.select(selectIsLoading);

  // Holiday type options for checkboxes
  holidayTypeOptions: { type: HolidayType; label: string; description: string }[] = [
    { type: 'public', label: 'Public Holidays', description: 'Official public holidays' },
    { type: 'bank', label: 'Bank Holidays', description: 'Banks and offices are closed' },
    { type: 'school', label: 'School Holidays', description: 'Schools are closed' },
    { type: 'optional', label: 'Optional Holidays', description: 'Majority take a day off' },
    { type: 'observance', label: 'Observances', description: 'Festivity, no paid day off' }
  ];

  form = this.formBuilder.group({
    monthlyIncome: [0, [Validators.min(0)]],
    monthlyCost: [0, [Validators.min(0)]],
    darkMode: [false],
    ignoreWeekends: [true],
    maxHoursPerDay: [8, [Validators.min(0.1), Validators.max(24)]],
    maxHoursEnabled: [true],
    holidayCountry: [''],
    holidayTypes: [DEFAULT_HOLIDAY_TYPES as HolidayType[]],
    firstDayOfWeek: [1, [Validators.min(0), Validators.max(6)]],
    overtimeRate: [0, [Validators.min(0)]],
    overwrite: [false]
  });

  selectedFile: File | null = null;
  importing = false;
  importResult: { imported: number; updated: number; skipped: number; total: number } | null = null;
  importError: string | null = null;
  showIncome = false;
  showCost = false;
  showOvertime = false;

  private holidayService = inject(HolidayService);

  constructor(private formBuilder: FormBuilder, private store: Store) {}

  ngOnInit(): void {
    this.store.dispatch(loadSettings());
    this.settings$.subscribe(settings => {
      if (settings)
        this.form.patchValue(settings, { emitEvent: false });
    });

    this.form.valueChanges
      .pipe(
        debounceTime(200),
        map(formValue => this.extractSettings(formValue as Partial<SettingsFormValue>)),
        distinctUntilChanged((previous, current) => JSON.stringify(previous) === JSON.stringify(current))
      )
      .subscribe(settings => {
        if (this.form.valid) {
          this.store.dispatch(SettingsActions.save({ settings }));
        }
      });

    this.lastImportResult$.subscribe(lastImportResult => {
      if (lastImportResult) {
        this.importing = false;
        this.importResult = lastImportResult;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.importResult = null;
      this.importError = null;
    }
  }

  importCsv(): void {
    if (!this.selectedFile)
      return;

    this.importing = true;
    this.importError = null;

    const reader = new FileReader();

    reader.onload = () => {
      const content = reader.result as string;
      const overwrite = this.form.get('overwrite')?.value ?? false;

      this.store.dispatch(SettingsActions.importCsv({ content, overwrite }));
    };

    reader.onerror = () => {
      this.importing = false;
      this.importError = 'Failed to read file';
    };

    reader.readAsText(this.selectedFile);
  }

  toggleIncomeVisibility(): void { this.showIncome = !this.showIncome; }
  toggleCostVisibility(): void { this.showCost = !this.showCost; }
  toggleOvertimeVisibility(): void { this.showOvertime = !this.showOvertime; }

  exportAllCsv(): void {
    this.store.dispatch(TasksActions.exportCsvAll());
  }

  setAutoDetectedCountry(): void {
    const cc = this.holidayService.detectCountryCode();

    this.form.patchValue({ holidayCountry: cc });
  }

  isHolidayTypeEnabled(type: HolidayType): boolean {
    const types = this.form.get('holidayTypes')?.value || [];

    return types.includes(type);
  }

  toggleHolidayType(type: HolidayType): void {
    const current = this.form.get('holidayTypes')?.value || [];
    const updated = current.includes(type)
      ? current.filter((ht: HolidayType) => ht !== type)
      : [...current, type];

    this.form.patchValue({ holidayTypes: updated });
  }

  private extractSettings(
    formValue: Partial<SettingsFormValue> | null | undefined
  ): Settings {
    const {
      monthlyIncome,
      monthlyCost,
      darkMode,
      ignoreWeekends,
      maxHoursPerDay,
      maxHoursEnabled,
      holidayCountry,
      holidayTypes,
      firstDayOfWeek,
      overtimeRate
    } = (formValue ?? {}) as Partial<SettingsFormValue>;

    return {
      monthlyIncome: monthlyIncome as number,
      monthlyCost: monthlyCost as number,
      darkMode: darkMode as boolean,
      ignoreWeekends: ignoreWeekends as boolean,
      maxHoursPerDay: maxHoursPerDay as number,
      maxHoursEnabled: maxHoursEnabled as boolean,
      holidayCountry: (holidayCountry ?? undefined) as string | undefined,
      holidayTypes: (holidayTypes ?? undefined) as HolidayType[] | undefined,
      firstDayOfWeek: (firstDayOfWeek ?? undefined) as number | undefined,
      overtimeRate: overtimeRate as number
    };
  }
}
