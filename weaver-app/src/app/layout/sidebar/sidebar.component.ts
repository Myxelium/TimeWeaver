import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV_ITEMS } from '../../shared/models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside
      class="w-16 bg-card border-r border-border flex flex-col"
    >
      <!-- Navigation Items -->
  <nav class="flex-1 py-6">
        <div class="flex flex-col space-y-1">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-primary text-primary-foreground"
              #rla="routerLinkActive"
              class="relative flex items-center justify-center w-12 h-12 mx-2 rounded-lg
                     hover:bg-accent hover:text-accent-foreground transition-colors group"
              [title]="item.title"
            >
              <!-- Icon placeholder - you can replace with actual icons -->
              <div class="w-6 h-6 flex items-center justify-center">
                @switch (item.icon) {
                  @case ('home') {
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 12l2-2m0 0l7-7 7 7
                           M5 10v10a1 1 0 001 1h3
                           m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3
                           m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4
                           a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  }
                  @case ('calendar') {
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  }
                  @case ('archive') {
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                  }
                }
              </div>

              <!-- Tooltip -->
              <div
                class="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded
                       shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all
                       duration-200 whitespace-nowrap z-50"
              >
                {{ item.label }}
              </div>
            </a>
          }
        </div>
      </nav>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SidebarComponent {
  navItems = NAV_ITEMS;
}
