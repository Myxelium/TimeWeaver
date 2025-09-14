import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="open()" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50" (click)="cancel()"></div>
      <div class="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 class="text-lg font-semibold mb-1">{{ options().title || 'Confirm' }}</h2>
          <p class="text-sm text-muted-foreground whitespace-pre-line">{{ options().message || 'Are you sure?' }}</p>
        </div>
        <div class="flex justify-end space-x-3 pt-2">
          <button (click)="cancel()" class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-sm">
            {{ options().cancelText || 'Cancel' }}
          </button>
          <button
            (click)="confirm()"
            data-confirm-primary
            [class.bg-destructive]="options().destructive"
            [class.text-destructive-foreground]="options().destructive"
            class="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors text-sm"
          >
            {{ options().confirmText || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDialogHostComponent {
  open = signal(false);
  options = signal<ConfirmOptions>({});
  private _resolver: ((result: boolean) => void) | null = null;
  private lastFocused: HTMLElement | null = null;

  show(opts: ConfirmOptions): Promise<boolean> {
    this.options.set(opts || {});
    this.lastFocused = document.activeElement as HTMLElement;
    this.open.set(true);
    queueMicrotask(() => {
      const btns = document.querySelectorAll('[data-confirm-primary]');
      (btns.item(0) as HTMLElement | null)?.focus();
    });
    return new Promise<boolean>(resolve => {
      this._resolver = resolve;
    });
  }

  confirm(): void {
    this.finish(true);
  }
  cancel(): void {
    this.finish(false);
  }
  private finish(val: boolean) {
    this.open.set(false);
    this._resolver?.(val);
    this._resolver = null;
    queueMicrotask(() => this.lastFocused?.focus());
  }
}
