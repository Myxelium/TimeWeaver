import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  Eye,
  EyeOff,
  LucideAngularModule
} from 'lucide-angular';

@Component({
  selector: 'app-settings-general',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule
  ],
  templateUrl: './settings-general.component.html'
})
export class SettingsGeneralComponent {
  @Input({ required: true }) form!: FormGroup;

  @Input() showIncome = false;
  @Input() showCost = false;
  @Input() showOvertime = false;

  @Output() toggleIncome = new EventEmitter<void>();
  @Output() toggleCost = new EventEmitter<void>();
  @Output() toggleOvertime = new EventEmitter<void>();

  readonly eye = Eye;
  readonly eyeOff = EyeOff;
}
