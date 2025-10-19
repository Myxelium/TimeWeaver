import { Injectable, ApplicationRef, ComponentRef, createComponent, EnvironmentInjector, inject } from '@angular/core';
import { ConfirmDialogHostComponent, ConfirmOptions } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);
  private hostRef: ComponentRef<ConfirmDialogHostComponent> | null = null;

  confirm(options: ConfirmOptions): Promise<boolean> {
    return this.ensureHost().show(options || {});
  }

  private ensureHost(): ConfirmDialogHostComponent {
    if (!this.hostRef) {
      this.hostRef = createComponent(ConfirmDialogHostComponent, {
        environmentInjector: this.injector
      });

      this.appRef.attachView(this.hostRef.hostView);
      document.body.appendChild(this.hostRef.location.nativeElement);
    }

    return this.hostRef.instance;
  }
}
