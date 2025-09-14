import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Settings } from '../../shared/models';
import { SettingsActions, loadSettings } from '../../store/settings/settings.actions';
import { selectSettings } from '../../store/settings/settings.selectors';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  settings$ = this.store.select(selectSettings);
  form = this.fb.group({
    monthlyIncome: [0, [Validators.min(0)]],
    monthlyCost: [0, [Validators.min(0)]],
    darkMode: [false],
    ignoreWeekends: [true]
  });

  constructor(private fb: FormBuilder, private store: Store) {}

  ngOnInit(): void {
    this.store.dispatch(loadSettings());
    this.settings$.subscribe(s => {
      if (s) this.form.patchValue(s, { emitEvent: false });
    });
  }

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.value as Settings;
    this.store.dispatch(SettingsActions.save({ settings: value }));
  }
}
