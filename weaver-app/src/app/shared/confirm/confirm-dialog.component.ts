import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

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
  templateUrl: './confirm-dialog.component.html'
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

  private finish(val: boolean): void {
    this.open.set(false);
    this._resolver?.(val);
    this._resolver = null;
    queueMicrotask(() => this.lastFocused?.focus());
  }
}
