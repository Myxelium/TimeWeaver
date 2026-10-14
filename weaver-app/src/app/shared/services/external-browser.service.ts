import { Injectable } from '@angular/core';

interface ElectronShellApi {
  openExternal?: (url: string) => Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class ExternalBrowserService {
  openInDefaultBrowser(url: string): void {
    const api = (window as unknown as { electronAPI?: ElectronShellApi }).electronAPI;

    if (api?.openExternal) {
      void api.openExternal(url);

      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
