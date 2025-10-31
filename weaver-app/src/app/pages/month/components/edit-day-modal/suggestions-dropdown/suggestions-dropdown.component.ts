import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-suggestions-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './suggestions-dropdown.component.html'
})
export class SuggestionsDropdownComponent {
  @Input() showSuggestions = false;
  @Input() showAllSuggestions = false;
  @Input() recentSuggestions: string[] = [];
  @Input() filteredSuggestions: string[] = [];
  @Input() allTaskTitles: string[] = [];

  @Output() toggleAll = new EventEmitter<void>();
  @Output() selectSuggestion = new EventEmitter<string>();

  onToggleAll(): void {
    this.toggleAll.emit();
  }

  onSelectSuggestion(suggestion: string): void {
    this.selectSuggestion.emit(suggestion);
  }
}
