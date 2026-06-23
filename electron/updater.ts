import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { UPDATE_TOKEN } from './update-token';

export function setupAutoUpdater(window: BrowserWindow) {
  // Repo privato: senza token l'app non può scaricare gli update. Se è stato
  // incorporato in build (CI), lo passiamo al provider GitHub per l'autenticazione.
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

  // Controlla aggiornamenti all'avvio e ogni ora
  autoUpdater.checkForUpdates().catch(console.error);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(console.error);
  }, 60 * 60 * 1000);
}
