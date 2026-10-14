import { BrowserWindow, shell } from 'electron';

import { isWorkItemPageUrl } from './ado/parse';

export function openInDefaultBrowser(url: string): void {
  if (!isWorkItemPageUrl(url))
    return;

  void shell.openExternal(url);
}

export function routeExternalLinks(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    openInDefaultBrowser(url);

    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isWorkItemPageUrl(url))
      return;

    event.preventDefault();
    openInDefaultBrowser(url);
  });
}
