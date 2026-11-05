import {
  Component,
  computed,
  input
} from '@angular/core';

import { workItemKind } from './work-item-kind.model';

@Component({
  selector: 'app-work-item-kind',
  standalone: true,
  templateUrl: './work-item-kind.component.html',
  host: { class: 'inline-flex max-w-full shrink-0' }
})
export class WorkItemKindComponent {
  type = input('');

  kind = computed(() => workItemKind(this.type()));
}
