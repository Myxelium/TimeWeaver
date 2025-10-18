import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Settings } from '../../shared/models';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';
import { SettingsActions, loadSettings } from '../../store/settings/settings.actions';
import { TasksActions } from '../../store/tasks/tasks.actions';
import { selectIsLoading } from '../../store/tasks/tasks.selectors';
import { selectLastImportResult, selectLastSaveSuccessAt, selectSettings } from '../../store/settings/settings.selectors';
import { skip } from 'rxjs';

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
  lastSaveAt$ = this.store.select(selectLastSaveSuccessAt);
  lastImportResult$ = this.store.select(selectLastImportResult);
  isLoading$ = this.store.select(selectIsLoading);

  form = this.formBuilder.group({
    monthlyIncome: [0, [Validators.min(0)]],
    monthlyCost: [0, [Validators.min(0)]],
    darkMode: [false],
    ignoreWeekends: [true],
    overwrite: [false]
  });

  saving = false;
  justSaved = false;
  selectedFile: File | null = null;
  importing = false;
  importResult: { imported: number; updated: number; skipped: number; total: number } | null = null;
  importError: string | null = null;
  showIncome = false;
  showCost = false;

  constructor(private formBuilder: FormBuilder, private store: Store) {}

  ngOnInit(): void {
    this.store.dispatch(loadSettings());
    this.settings$.subscribe(settings => {
      if (settings)
        this.form.patchValue(settings, { emitEvent: false });
    });
    this.lastSaveAt$.pipe(skip(1)).subscribe(lastSaveAt => {
      if (lastSaveAt) {
        this.saving = false;
        this.justSaved = true;
        setTimeout(() => this.justSaved = false, 2000);
      }
    });
    this.lastImportResult$.subscribe(lastImportResult => {
      if (lastImportResult) {
        this.importing = false;
        this.importResult = lastImportResult;
      }
    });
  }

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.value as Settings;
    this.saving = true;
    this.store.dispatch(SettingsActions.save({ settings: value }));
  }

  onFileSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
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

  exportAllCsv(): void {
    this.store.dispatch(TasksActions.exportCsvAll());
  }
}
