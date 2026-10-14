import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { selectAdoOrganization } from '../../store/settings/settings.selectors';
import { selectAdoSuggestions } from '../../store/tasks/tasks.selectors';
import { syncedWorkItemId, workItemPageUrl } from '../ado-titles.model';
import { AdoSuggestion } from '../models';
import { ExternalBrowserService, TaskDetailsService } from '../services';

@Component({
  selector: 'app-ado-title',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ado-title.component.html',
  host: { class: 'ado-title' }
})
export class AdoTitleComponent {
  title = input.required<string>();
  adoWorkItemId = input<number | null>(null);
  showAzureIcon = input(true);

  private organization = toSignal(inject(Store).select(selectAdoOrganization), { initialValue: '' });
  private suggestions = toSignal(inject(Store).select(selectAdoSuggestions), { initialValue: [] as AdoSuggestion[] });

  private browser = inject(ExternalBrowserService);
  private taskDetails = inject(TaskDetailsService);

  workItemUrl = computed(() => {
    const title = this.title();
    const suggestions = this.suggestions();
    const adoId = syncedWorkItemId(title, this.adoWorkItemId(), suggestions);
    const organization = this.organization();

    return workItemPageUrl(organization, adoId);
  });

  openTaskDetails(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.taskDetails.openDetails(this.title(), this.adoWorkItemId());
  }

  openWorkItem(event: Event, url: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.browser.openInDefaultBrowser(url);
  }
}
