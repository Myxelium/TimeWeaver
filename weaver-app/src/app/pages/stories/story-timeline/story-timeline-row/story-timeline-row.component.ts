import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

import { AdoTitleComponent } from '../../../../shared/ado-title/ado-title.component';
import { WorkItemKindComponent } from '../../../../shared/work-item-kind/work-item-kind.component';
import { workItemKind } from '../../../../shared/work-item-kind/work-item-kind.model';
import { StoryYearRow } from '../../story-year.model';

@Component({
  selector: 'app-story-timeline-row',
  standalone: true,
  imports: [
    CommonModule,
    AdoTitleComponent,
    WorkItemKindComponent
  ],
  templateUrl: './story-timeline-row.component.html'
})
export class StoryTimelineRowComponent {
  row = input.required<StoryYearRow>();
  months = input.required<string[]>();

  barColor(): string {
    return workItemKind(this.row().workItemType)?.color ?? '#71717A';
  }

  barTitle(activeOn: string, rangeEnd: string): string {
    const row = this.row();
    const kind = workItemKind(row.workItemType);
    const hours = row.hours === 1 ? '1 hour logged' : `${row.hours} hours logged`;
    const prefix = kind ? `${kind.label}. ` : '';

    return `${prefix}${row.title}: ${activeOn} - ${rangeEnd}. ${hours}`;
  }
}
