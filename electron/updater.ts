import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { UPDATE_TOKEN } from './update-token';
import { setupMacUpdater, quitAndInstallMac } from './mac-updater';

export function setupAutoUpdater(window: BrowserWindow) {
  // macOS: updater custom che NON usa Squirrel.Mac → nessuna firma Apple richiesta.
  if (process.platform === 'darwin') {
    setupMacUpdater(window);
    return;
  }

  // Windows: electron-updater (NSIS) — funziona anche senza firma.
  if (UPDATE_TOKEN) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'thomas-addamo',
      repo: 'dieffe-preventivi',
      private: true,
      token: UPDATE_TOKEN,
    } as Parameters<typeof autoUpdater.setFeedURL>[0]);
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    window.webContents.send('update-available');
  });
  autoUpdater.on('update-downloaded', () => {
    window.webContents.send('update-downloaded');
  });
  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater error:', err);
  });

  autoUpdater.checkForUpdates().catch(console.error);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(console.error);
  }, 60 * 60 * 1000);
}

/** Installa l'aggiornamento scaricato e riavvia (chiamato dal pulsante "Riavvia"). */
export function installUpdate() {
  if (process.platform === 'darwin') {
    quitAndInstallMac();
    return;
  }
  autoUpdater.quitAndInstall();
}
