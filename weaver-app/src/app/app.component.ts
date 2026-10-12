import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';

import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { PopupOverlayComponent } from './pages/overlay/popup-overlay.component';
import { loadSettings } from './store/settings/settings.actions';

function overlayLaunchActive(): boolean {
  const overlay = new URLSearchParams(window.location.search).get('overlay');

  if (overlay === 'time-log' || overlay === 'reminder')
    return true;

  return /\/overlay\/(time-log|reminder)\//.test(window.location.pathname);
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    PopupOverlayComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'weaver-app';

  readonly isOverlay = overlayLaunchActive();

  readonly overlayFromRoute = /\/overlay\/(time-log|reminder)\//.test(window.location.pathname);

  private store = inject(Store);

  constructor() {
    if (this.isOverlay) {
      document.documentElement.classList.add('overlay-window');
      return;
    }

    this.store.dispatch(loadSettings());
  }
}
