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
  selector: 'app-settings-azure',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule
  ],
  templateUrl: './settings-azure.component.html'
})
export class SettingsAzureComponent {
  @Input({ required: true }) form!: FormGroup;

  @Input() adoOrganization = '';
  @Input() adoToken = '';
  @Input() showAdoToken = false;
  @Input() adoPatConfigured = false;
  @Input() adoAuthMethod: 'pat' | 'azure-cli' = 'pat';
  @Input() adoLastSyncOn = '';
  @Input() adoLastSyncError = '';
  @Input() adoSyncing = false;
  @Input() adoFormError = '';
  @Input() adoSyncReady = false;

  @Output() organizationInput = new EventEmitter<Event>();
  @Output() authMethodChange = new EventEmitter<Event>();
  @Output() tokenInput = new EventEmitter<Event>();
  @Output() toggleToken = new EventEmitter<void>();
  @Output() saveConnection = new EventEmitter<void>();
  @Output() syncNow = new EventEmitter<void>();
  @Output() clearToken = new EventEmitter<void>();

  readonly eye = Eye;
  readonly eyeOff = EyeOff;
}
