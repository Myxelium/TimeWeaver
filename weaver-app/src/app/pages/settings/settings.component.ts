import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnInit
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Store } from '@ngrx/store';
import {
  Eye,
  EyeOff,
  LucideAngularModule
} from 'lucide-angular';
import {
  debounceTime,
  distinctUntilChanged,
  map
} from 'rxjs';

import {
  DEFAULT_HOLIDAY_TYPES,
  HolidayType,
  PopupRule,
  PopupRuleType,
  Settings
} from '../../shared/models';
import { HolidayService } from '../../shared/services';
import { loadSettings, SettingsActions } from '../../store/settings/settings.actions';
import { selectLastImportResult, selectSettings } from '../../store/settings/settings.selectors';
import { TasksActions } from '../../store/tasks/tasks.actions';
import { selectIsLoading } from '../../store/tasks/tasks.selectors';

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
  launchAtLogin: boolean | null;
  popupRules: PopupRule[] | null;
  overwrite?: boolean | null;
}

const DEFAULT_REMINDER_SECONDS = 30;
const MAX_REMINDER_SECONDS = 86400;
const MAX_POPUP_MESSAGE_LENGTH = 500;
const MAX_INTERVAL_MINUTES = 1440;
const WEDNESDAY = 3;
const THURSDAY = 4;
const FRIDAY = 5;
const HEX_RADIX = 16;
const DEFAULT_WEEKDAYS = [
  1,
  2,
  WEDNESDAY,
  THURSDAY,
  FRIDAY
];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule
  ],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private store = inject(Store);
  private holidayService = inject(HolidayService);

  eye = Eye;
  eyeOff = EyeOff;

  settings$ = this.store.select(selectSettings);
  lastImportResult$ = this.store.select(selectLastImportResult);
  isLoading$ = this.store.select(selectIsLoading);

  weekdayOptions: { value: number; label: string }[] = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 0, label: 'Sun' }
  ];

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
    launchAtLogin: [false],
    popupRules: this.formBuilder.array<FormGroup>([]),
    overwrite: [false]
  });

  selectedFile: File | null = null;
  importing = false;
  importResult: { imported: number; updated: number; skipped: number; total: number } | null = null;
  importError: string | null = null;
  showIncome = false;
  showCost = false;
  showOvertime = false;

  ngOnInit(): void {
    this.store.dispatch(loadSettings());
    this.settings$.subscribe(settings => {
      if (settings)
        this.syncFromSettings(settings);
    });

    this.form.get('launchAtLogin')?.valueChanges.subscribe(launchAtLogin => {
      this.applyLaunchGate(!!launchAtLogin);
    });

    this.form.valueChanges
      .pipe(
        debounceTime(200),
        map(() => this.extractSettings()),
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

  get popupRules(): FormArray<FormGroup> {
    return this.form.controls.popupRules;
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

    reader.onload = (): void => {
      const content = reader.result as string;
      const overwrite = this.form.get('overwrite')?.value ?? false;

      this.store.dispatch(SettingsActions.importCsv({ content, overwrite }));
    };

    reader.onerror = (): void => {
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

  addPopupRule(): void {
    const launchAtLogin = !!this.form.get('launchAtLogin')?.value;

    this.popupRules.push(this.createRuleGroup({
      enabled: launchAtLogin,
      type: 'time-log',
      time: '17:00',
      weekdays: DEFAULT_WEEKDAYS,
      message: '',
      durationSeconds: DEFAULT_REMINDER_SECONDS,
      intervalMinutes: 0,
      onlyIfNothingReported: false
    }));

    this.applyLaunchGate(launchAtLogin);
  }

  removePopupRule(index: number): void {
    this.popupRules.removeAt(index);
  }

  isWeekdaySelected(index: number, day: number): boolean {
    const weekdays = this.popupRules.at(index).get('weekdays')?.value as number[] | null;

    return !!weekdays?.includes(day);
  }

  toggleWeekday(index: number, day: number): void {
    const control = this.popupRules.at(index).get('weekdays');
    const current = [...((control?.value as number[] | null) ?? [])];
    const next = current.includes(day)
      ? current.filter(value => value !== day)
      : [...current, day];

    control?.setValue(next);
  }

  toggleHolidayType(type: HolidayType): void {
    const current = this.form.get('holidayTypes')?.value || [];
    const updated = current.includes(type)
      ? current.filter((ht: HolidayType) => ht !== type)
      : [...current, type];

    this.form.patchValue({ holidayTypes: updated });
  }

  private syncFromSettings(settings: Settings): void {
    const { popupRules, ...rest } = settings;

    this.form.patchValue(rest, { emitEvent: false });
    this.syncPopupRules(popupRules ?? []);
    this.applyLaunchGate(!!settings.launchAtLogin);
  }

  private syncPopupRules(rules: PopupRule[]): void {
    const incoming = JSON.stringify(rules.map(rule => this.comparableRule(rule)));
    const currentRules = (this.form.getRawValue().popupRules ?? []) as PopupRule[];
    const current = JSON.stringify(currentRules.map(rule => this.comparableRule(rule)));

    if (incoming !== current) {
      this.popupRules.clear({ emitEvent: false });

      for (const rule of rules)
        this.popupRules.push(this.createRuleGroup(rule), { emitEvent: false });

      return;
    }

    for (const rule of rules) {
      const group = this.popupRules.controls.find(control => control.get('id')?.value === rule.id);

      group?.get('lastResolvedDate')?.setValue(rule.lastResolvedDate ?? null, { emitEvent: false });
      group?.get('lastTriggeredAt')?.setValue(rule.lastTriggeredAt ?? null, { emitEvent: false });
    }
  }

  private comparableRule(rule: PopupRule): Omit<PopupRule, 'lastResolvedDate' | 'lastTriggeredAt'> {
    return {
      id: rule.id,
      enabled: !!rule.enabled,
      type: rule.type === 'reminder' ? 'reminder' : 'time-log',
      time: this.normalizeTime(rule.time),
      weekdays: [...(rule.weekdays ?? [])].sort(),
      message: rule.message ?? '',
      durationSeconds: Number(rule.durationSeconds) || DEFAULT_REMINDER_SECONDS,
      intervalMinutes: Number(rule.intervalMinutes) || 0,
      onlyIfNothingReported: !!rule.onlyIfNothingReported
    };
  }

  private normalizeTime(value: string | null | undefined): string {
    const match = /^(\d{2}):(\d{2})/.exec(value ?? '');

    if (!match)
      return '17:00';

    return `${match[1]}:${match[2]}`;
  }

  private createRuleGroup(rule: Partial<PopupRule>): FormGroup {
    return this.formBuilder.group({
      id: [rule.id ?? this.createRuleId()],
      enabled: [!!rule.enabled],
      type: [rule.type ?? 'time-log'],
      time: [rule.time ?? '17:00', [Validators.required, Validators.pattern(/^\d{2}:\d{2}/)]],
      weekdays: [rule.weekdays ?? DEFAULT_WEEKDAYS],
      message: [rule.message ?? '', [Validators.maxLength(MAX_POPUP_MESSAGE_LENGTH)]],
      durationSeconds: [
        rule.durationSeconds ?? DEFAULT_REMINDER_SECONDS,
        [
          Validators.required,
          Validators.min(1),
          Validators.max(MAX_REMINDER_SECONDS)
        ]
      ],
      intervalMinutes: [
        rule.intervalMinutes ?? 0,
        [
          Validators.required,
          Validators.min(0),
          Validators.max(MAX_INTERVAL_MINUTES)
        ]
      ],
      onlyIfNothingReported: [!!rule.onlyIfNothingReported],
      lastResolvedDate: [rule.lastResolvedDate ?? null],
      lastTriggeredAt: [rule.lastTriggeredAt ?? null]
    });
  }

  private createRuleId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      return crypto.randomUUID();

    return `popup-${Date.now()}-${Math.random().toString(HEX_RADIX)
      .slice(2)}`;
  }

  private applyLaunchGate(launchAtLogin: boolean): void {
    for (const control of this.popupRules.controls) {
      const enabled = control.get('enabled');

      if (!enabled)
        continue;

      if (!launchAtLogin && enabled.value)
        enabled.setValue(false, { emitEvent: false });

      if (launchAtLogin)
        enabled.enable({ emitEvent: false });
      else
        enabled.disable({ emitEvent: false });
    }
  }

  private extractSettings(): Settings {
    const formValue = this.form.getRawValue() as SettingsFormValue;
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
      overtimeRate,
      launchAtLogin,
      popupRules
    } = formValue;
    const canEnablePopups = !!launchAtLogin;

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
      overtimeRate: overtimeRate as number,
      launchAtLogin: canEnablePopups,
      popupRules: (popupRules ?? []).map(rule => ({
        id: rule.id,
        enabled: canEnablePopups && !!rule.enabled,
        type: (rule.type === 'reminder' ? 'reminder' : 'time-log') as PopupRuleType,
        time: this.normalizeTime(rule.time),
        weekdays: rule.weekdays ?? [],
        message: rule.message ?? '',
        durationSeconds: Number(rule.durationSeconds) || DEFAULT_REMINDER_SECONDS,
        intervalMinutes: Number(rule.intervalMinutes) || 0,
        onlyIfNothingReported: !!rule.onlyIfNothingReported,
        lastResolvedDate: rule.lastResolvedDate ?? null,
        lastTriggeredAt: rule.lastTriggeredAt ?? null
      }))
    };
  }
}
