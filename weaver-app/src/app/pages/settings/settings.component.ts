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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  ArrowDownUp,
  Bell,
  CalendarDays,
  Cloud,
  Eye,
  EyeOff,
  LucideAngularModule,
  SlidersHorizontal
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
import { DatabaseService, HolidayService } from '../../shared/services';
import { loadSettings, SettingsActions } from '../../store/settings/settings.actions';
import { selectLastImportResult, selectSettings } from '../../store/settings/settings.selectors';
import { TasksActions } from '../../store/tasks/tasks.actions';
import { selectIsLoading } from '../../store/tasks/tasks.selectors';
import { SettingsAzureComponent } from './sections/settings-azure/settings-azure.component';
import { SettingsDataComponent } from './sections/settings-data/settings-data.component';
import { SettingsGeneralComponent } from './sections/settings-general/settings-general.component';
import { SettingsHolidaysComponent } from './sections/settings-holidays/settings-holidays.component';
import { SettingsPopupsComponent } from './sections/settings-popups/settings-popups.component';

interface SettingsFormValue {
  monthlyIncome: number | null;
  monthlyCost: number | null;
  darkMode: boolean | null;
  ignoreWeekends: boolean | null;
  skipWeekendsOnSelect: boolean | null;
  skipHolidaysOnSelect: boolean | null;
  maxHoursPerDay: number | null;
  maxHoursEnabled: boolean | null;
  holidayCountry: string | null;
  holidayTypes: HolidayType[] | null;
  firstDayOfWeek: number | null;
  overtimeRate: number | null;
  launchAtLogin: boolean | null;
  adoSyncEnabled: boolean | null;
  popupRules: PopupRule[] | null;
  overwrite?: boolean | null;
}

const defaultMaxHoursPerDay = 8;
const minimumHoursPerDay = 0.1;
const hoursInADay = 24;
const saturdayIndex = 6;
const settingsSaveDelayMs = 200;
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

type SettingsSection = 'general' | 'holidays' | 'popups' | 'azure' | 'data';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    RouterLink,
    SettingsGeneralComponent,
    SettingsHolidaysComponent,
    SettingsPopupsComponent,
    SettingsAzureComponent,
    SettingsDataComponent
  ],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private store = inject(Store);
  private holidayService = inject(HolidayService);
  private database = inject(DatabaseService);
  private route = inject(ActivatedRoute);

  eye = Eye;
  eyeOff = EyeOff;

  sections: {
    id: SettingsSection;
    label: string;
    description: string;
    icon: typeof SlidersHorizontal;
  }[] = [
    {
      id: 'general',
      label: 'General',
      description: 'Income, overtime, and how days are counted and selected.',
      icon: SlidersHorizontal
    },
    {
      id: 'holidays',
      label: 'Holidays',
      description: 'Country and which holiday types appear on the calendar.',
      icon: CalendarDays
    },
    {
      id: 'popups',
      label: 'Side popups',
      description: 'Reminders and time-log prompts above the taskbar.',
      icon: Bell
    },
    {
      id: 'azure',
      label: 'Azure DevOps',
      description: 'Work items assigned to you, kept on this computer.',
      icon: Cloud
    },
    {
      id: 'data',
      label: 'Import & export',
      description: 'Bring in a task CSV or download every task.',
      icon: ArrowDownUp
    }
  ];

  activeSection: SettingsSection = 'general';

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
    skipWeekendsOnSelect: [false],
    skipHolidaysOnSelect: [false],
    maxHoursPerDay: [defaultMaxHoursPerDay, [Validators.min(minimumHoursPerDay), Validators.max(hoursInADay)]],
    maxHoursEnabled: [true],
    holidayCountry: [''],
    holidayTypes: [DEFAULT_HOLIDAY_TYPES as HolidayType[]],
    firstDayOfWeek: [1, [Validators.min(0), Validators.max(saturdayIndex)]],
    overtimeRate: [0, [Validators.min(0)]],
    launchAtLogin: [false],
    adoSyncEnabled: [false],
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
  adoOrganization = '';
  adoToken = '';
  showAdoToken = false;
  adoPatConfigured = false;
  adoAuthMethod: 'pat' | 'azure-cli' = 'pat';
  adoLastSyncOn = '';
  adoLastSyncError = '';
  adoSyncing = false;
  adoFormError = '';
  private adoOrgDirty = false;
  private adoAuthDirty = false;
  private savedAdoAuthMethod: 'pat' | 'azure-cli' = 'pat';
  private savedAdoOrganization = '';

  private handleAdoSyncResult = (result: { error: string | null }): void => {
    this.adoSyncing = false;
    this.adoFormError = result.error ?? '';
    this.store.dispatch(loadSettings());
    this.store.dispatch(TasksActions.loadAdoSuggestions());
  };

  private handleAdoSyncFailure = (): void => {
    this.adoSyncing = false;
    this.adoFormError = 'Azure DevOps could not be read.';
    this.store.dispatch(loadSettings());
  };

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.activeSection = this.sectionFromParam(params.get('section'));
    });

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
        debounceTime(settingsSaveDelayMs),
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

  get activeSectionItem(): (typeof this.sections)[number] {
    return this.sections.find(section => section.id === this.activeSection) ?? this.sections[0];
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

  toggleAdoTokenVisibility(): void { this.showAdoToken = !this.showAdoToken; }

  onAdoOrganizationInput(event: Event): void {
    this.adoOrganization = (event.target as HTMLInputElement).value;
    this.adoOrgDirty = true;
    this.adoFormError = '';
  }

  onAdoTokenInput(event: Event): void {
    this.adoToken = (event.target as HTMLInputElement).value;
  }

  onAdoAuthMethodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.adoAuthMethod = value === 'azure-cli' ? 'azure-cli' : 'pat';
    this.adoAuthDirty = true;
    this.adoFormError = '';
  }

  get adoSyncReady(): boolean {
    if (!this.form.get('adoSyncEnabled')?.value)
      return false;

    if (this.savedAdoAuthMethod === 'azure-cli')
      return this.savedAdoOrganization.trim().length > 0;

    return this.adoPatConfigured;
  }

  saveAdoConnection(): void {
    const organization = this.readOrganization(this.adoOrganization);

    if (organization === null) {
      this.adoFormError = 'Enter an Azure DevOps organization name.';
      return;
    }

    const settings: Settings = {
      ...this.extractSettings(),
      adoOrganization: organization,
      adoAuthMethod: this.adoAuthMethod
    };
    const token = this.adoToken.trim();

    if (token)
      settings.adoPat = token;

    this.adoFormError = '';
    this.adoOrgDirty = false;
    this.adoAuthDirty = false;
    this.adoToken = '';
    this.store.dispatch(SettingsActions.save({ settings }));
  }

  clearAdoToken(): void {
    this.adoToken = '';
    this.store.dispatch(SettingsActions.save({
      settings: { ...this.extractSettings(), clearAdoPat: true }
    }));
  }

  syncAdo(): void {
    if (!this.adoSyncReady)
      return;

    this.adoSyncing = true;
    this.adoFormError = '';
    this.database.syncAdo().subscribe({
      next: this.handleAdoSyncResult,
      error: this.handleAdoSyncFailure
    });
  }

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

  private sectionFromParam(value: string | null): SettingsSection {
    if (this.sections.some(section => section.id === value))
      return value as SettingsSection;

    return 'general';
  }

  private syncFromSettings(settings: Settings): void {
    const {
      popupRules,
      adoOrganization,
      adoPatConfigured,
      adoLastSyncOn,
      adoLastSyncError,
      adoAuthMethod,
      adoPat,
      clearAdoPat,
      ...rest
    } = settings;

    void adoPat;
    void clearAdoPat;

    this.adoPatConfigured = !!adoPatConfigured;
    this.adoLastSyncOn = adoLastSyncOn ?? '';
    this.adoLastSyncError = adoLastSyncError ?? '';
    this.savedAdoAuthMethod = adoAuthMethod === 'azure-cli' ? 'azure-cli' : 'pat';
    this.savedAdoOrganization = adoOrganization ?? '';

    if (!this.adoOrgDirty)
      this.adoOrganization = adoOrganization ?? '';

    if (!this.adoAuthDirty)
      this.adoAuthMethod = this.savedAdoAuthMethod;

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
      skipWeekendsOnSelect,
      skipHolidaysOnSelect,
      maxHoursPerDay,
      maxHoursEnabled,
      holidayCountry,
      holidayTypes,
      firstDayOfWeek,
      overtimeRate,
      launchAtLogin,
      adoSyncEnabled,
      popupRules
    } = formValue;
    const canEnablePopups = !!launchAtLogin;

    return {
      monthlyIncome: monthlyIncome as number,
      monthlyCost: monthlyCost as number,
      darkMode: darkMode as boolean,
      ignoreWeekends: ignoreWeekends as boolean,
      skipWeekendsOnSelect: !!skipWeekendsOnSelect,
      skipHolidaysOnSelect: !!skipHolidaysOnSelect,
      maxHoursPerDay: maxHoursPerDay as number,
      maxHoursEnabled: maxHoursEnabled as boolean,
      holidayCountry: (holidayCountry ?? undefined) as string | undefined,
      holidayTypes: (holidayTypes ?? undefined) as HolidayType[] | undefined,
      firstDayOfWeek: (firstDayOfWeek ?? undefined) as number | undefined,
      overtimeRate: overtimeRate as number,
      launchAtLogin: canEnablePopups,
      adoSyncEnabled: !!adoSyncEnabled,
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

  private readOrganization(input: string): string | null {
    const trimmed = input.trim().replace(/\/+$/, '');

    if (!trimmed)
      return '';

    const fromUrl = /^https:\/\/dev\.azure\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,62})$/i.exec(trimmed);
    const name = fromUrl ? fromUrl[1] : trimmed;

    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(name))
      return null;

    return name;
  }
}
