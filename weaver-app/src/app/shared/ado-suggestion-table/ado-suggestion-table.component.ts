import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { LucideAngularModule, Plus } from 'lucide-angular';

import { AdoSuggestion } from '../models';

@Component({
  selector: 'app-ado-suggestion-table',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './ado-suggestion-table.component.html'
})
export class AdoSuggestionTableComponent {
  @Input() suggestions: AdoSuggestion[] = [];

  @Input() showAdd = false;

  @Input() loggedIds: number[] = [];

  @Output() add = new EventEmitter<AdoSuggestion>();

  readonly Plus = Plus;

  isLogged(adoId: number): boolean {
    return this.loggedIds.includes(adoId);
  }
}
