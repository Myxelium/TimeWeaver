import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

import { StoryYearRow } from '../../story-year.model';

@Component({
  selector: 'app-story-timeline-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './story-timeline-row.component.html'
})
export class StoryTimelineRowComponent {
  row = input.required<StoryYearRow>();
  months = input.required<string[]>();

  barTitle(activeOn: string, rangeEnd: string): string {
    const row = this.row();
    const hours = row.hours === 1 ? '1 hour logged' : `${row.hours} hours logged`;

    return `${row.title}: ${activeOn} - ${rangeEnd}. ${hours}`;
  }
}
