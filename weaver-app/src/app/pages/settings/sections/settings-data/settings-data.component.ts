import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-settings-data',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings-data.component.html'
})
export class SettingsDataComponent {
  @Input({ required: true }) form!: FormGroup;

  @Input() selectedFile: File | null = null;
  @Input() importing = false;
  @Input() importResult: { imported: number; updated: number; skipped: number; total: number } | null = null;
  @Input() importError: string | null = null;

  @Input() isLoading$!: Observable<boolean>;

  @Output() fileSelected = new EventEmitter<Event>();
  @Output() importTasks = new EventEmitter<void>();
  @Output() exportTasks = new EventEmitter<void>();
}
