import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { loadSettings } from './store/settings/settings.actions';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'weaver-app';
  constructor(private store: Store) {
    this.store.dispatch(loadSettings());
  }
}
