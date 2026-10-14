import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

import { monthLabels, StoryYearRow } from '../story-year.model';
import { StoryTimelineRowComponent } from './story-timeline-row/story-timeline-row.component';

@Component({
  selector: 'app-story-timeline',
  standalone: true,
  imports: [CommonModule, StoryTimelineRowComponent],
  templateUrl: './story-timeline.component.html',
  host: { style: 'display: block' }
})
export class StoryTimelineComponent {
  rows = input<StoryYearRow[]>([]);

  readonly months = monthLabels();
}
