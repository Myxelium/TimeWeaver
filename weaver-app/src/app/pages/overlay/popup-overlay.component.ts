import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { format } from 'date-fns';

import { PopupContext, PopupEntry } from '../../shared/models';
import { SuggestionsDropdownComponent } from '../month/components/edit-day-modal/suggestions-dropdown/suggestions-dropdown.component';

interface TimeRow {
  key: string;
  title: string;
  selected: boolean;
  showSuggestions: boolean;
  showAllSuggestions: boolean;
  filteredSuggestions: string[];
}

const RECENT_SUGGESTION_COUNT = 5;
const ALL_SUGGESTION_COUNT = 15;
const SUGGESTION_BLUR_DELAY_MS = 200;

interface PopupApi {
  getContext(ruleId: string): Promise<PopupContext>;
  submit(ruleId: string, entries: PopupEntry[]): Promise<boolean>;
  dismiss(ruleId: string): Promise<boolean>;
  resize(height: number): void;
}

@Component({
  selector: 'app-popup-overlay',
  standalone: true,
  imports: [CommonModule, SuggestionsDropdownComponent],
  templateUrl: './popup-overlay.component.html'
})
export class PopupOverlayComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('root') root?: ElementRef<HTMLElement>;

  context: PopupContext | null = null;
  loadError: string | null = null;
  saveError: string | null = null;

  rows: TimeRow[] = [];

  saving = false;

  private route = inject(ActivatedRoute);

  private observer?: ResizeObserver;

  private lastHeight = 0;
  private rowKey = 0;
  private soundPlayed = false;

  ngOnInit(): void {
    this.playNotificationSound();
    void this.loadContext();
  }

  ngAfterViewInit(): void {
    if (!this.root)
      return;

    this.observer = new ResizeObserver(() => this.publishSize());
    this.observer.observe(this.root.nativeElement);
    this.publishSize();
  }

  get recentTitles(): string[] {
    return this.context?.recentTitles ?? [];
  }

  get recentSuggestions(): string[] {
    return this.recentTitles.slice(0, RECENT_SUGGESTION_COUNT);
  }

  get previousDayLabel(): string {
    if (!this.context?.previousDate)
      return '';

    return format(new Date(`${this.context.previousDate}T00:00:00`), 'EEEE d MMM');
  }

  get savableRows(): TimeRow[] {
    return this.rows.filter(row => row.selected && row.title.trim());
  }

  hoursFor(row: TimeRow): number | null {
    if (!this.context || this.context.remainingHours <= 0)
      return null;

    const rows = this.savableRows;
    const index = rows.indexOf(row);

    if (index < 0)
      return null;

    return splitHours(this.context.remainingHours, rows.length)[index] ?? null;
  }

  addRow(): void {
    this.rows = [...this.rows, this.createRow('', true)];
  }

  clearRows(): void {
    this.rows = [this.createRow('', true)];
  }

  toggleRow(row: TimeRow, checked: boolean): void {
    row.selected = checked;
  }

  checkboxChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  onTitleInput(row: TimeRow, event: Event): void {
    row.title = (event.target as HTMLInputElement).value;
    this.filterSuggestions(row);
  }

  onTitleFocus(row: TimeRow): void {
    if (row.title.trim()) {
      this.filterSuggestions(row);
      return;
    }

    row.filteredSuggestions = this.recentSuggestions;
    row.showSuggestions = row.filteredSuggestions.length > 0;
  }

  onTitleBlur(row: TimeRow): void {
    setTimeout(() => {
      row.showSuggestions = false;
      row.showAllSuggestions = false;
    }, SUGGESTION_BLUR_DELAY_MS);
  }

  toggleAll(row: TimeRow): void {
    row.showAllSuggestions = !row.showAllSuggestions;
    row.filteredSuggestions = row.showAllSuggestions
      ? this.recentTitles.slice(0, ALL_SUGGESTION_COUNT)
      : this.recentSuggestions;

    row.showSuggestions = row.filteredSuggestions.length > 0;
  }

  selectSuggestion(row: TimeRow, title: string): void {
    row.title = title;
    row.showSuggestions = false;
    row.showAllSuggestions = false;
  }

  async submit(): Promise<void> {
    const api = this.popupApi();
    const rows = this.savableRows;

    if (!api || !this.context || this.saving)
      return;

    if (rows.length === 0) {
      this.saveError = 'Choose at least one user story.';
      return;
    }

    const hours = splitHours(this.context.remainingHours, rows.length);
    const entries = rows.map((row, index) => ({
      title: row.title.trim(),
      hours: hours[index] ?? 0
    }));

    this.saving = true;
    this.saveError = null;

    try {
      await api.submit(this.context.ruleId, entries);
    } catch {
      this.saving = false;
      this.saveError = 'Could not save today\'s time.';
    }
  }

  dismiss(): void {
    const ruleId = this.context?.ruleId
      || new URLSearchParams(window.location.search).get('ruleId')
      || '';

    void this.popupApi()?.dismiss(ruleId);
  }

  private async loadContext(): Promise<void> {
    const api = this.popupApi();
    const ruleId = this.route.snapshot.paramMap.get('ruleId')
      || new URLSearchParams(window.location.search).get('ruleId')
      || '';

    if (!api) {
      this.loadError = 'Side popups run in the Weaver desktop app.';
      return;
    }

    try {
      this.context = await api.getContext(ruleId);
      document.documentElement.classList.toggle('dark', !!this.context.darkMode);
      this.rows = this.context.previousTitles.map(title => this.createRow(title, true));

      if (this.rows.length === 0)
        this.rows = [this.createRow('', true)];
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Could not open this popup.';
    }
  }

  private createRow(title: string, selected: boolean): TimeRow {
    this.rowKey += 1;

    return {
      key: String(this.rowKey),
      title,
      selected,
      showSuggestions: false,
      showAllSuggestions: false,
      filteredSuggestions: []
    };
  }

  private filterSuggestions(row: TimeRow): void {
    const value = row.title.trim().toLowerCase();

    if (!value) {
      row.showSuggestions = false;
      row.filteredSuggestions = [];
      return;
    }

    row.filteredSuggestions = this.recentTitles
      .filter(title => title.toLowerCase().includes(value))
      .slice(0, 10);

    row.showSuggestions = row.filteredSuggestions.length > 0;
  }

  private playNotificationSound(): void {
    if (this.soundPlayed)
      return;

    this.soundPlayed = true;

    const audio = new Audio(new URL('assets/notification.wav', document.baseURI).href);

    audio.loop = false;
    void audio.play().catch(() => undefined);
  }

  private publishSize(): void {
    const height = Math.ceil(this.root?.nativeElement.offsetHeight ?? 0);
    const api = this.popupApi();

    if (!api || height <= 0 || Math.abs(height - this.lastHeight) < 2)
      return;

    this.lastHeight = height;
    api.resize(height);
  }

  private popupApi(): PopupApi | undefined {
    return (window as unknown as { popupAPI?: PopupApi }).popupAPI;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

function splitHours(total: number, count: number): number[] {
  if (count <= 0)
    return [];

  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  const amounts = Array.from({ length: count }, () => base);

  amounts[count - 1] += remainder;

  return amounts.map(amount => amount / 100);
}
