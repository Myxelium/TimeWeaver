import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  input
} from '@angular/core';
import { Clock, LucideAngularModule } from 'lucide-angular';

import { AdoTitleComponent } from '../../../shared/ado-title/ado-title.component';
import { AdoSuggestion } from '../../../shared/models';
import { WorkItemKindComponent } from '../../../shared/work-item-kind/work-item-kind.component';
import { timeGapLabel, timeGapsToFill } from '../time-gap.model';

@Component({
  selector: 'app-time-gaps',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AdoTitleComponent,
    WorkItemKindComponent
  ],
  templateUrl: './time-gaps.component.html',
  host: { style: 'display: block' }
})
export class TimeGapsComponent {
  readonly Clock = Clock;

  suggestions = input<AdoSuggestion[]>([]);

  gaps = computed(() => timeGapsToFill(this.suggestions()));

  gapLabel(item: AdoSuggestion): string {
    return item.timeGap ? timeGapLabel(item.timeGap) : '';
  }
}
