import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

export function setupAutoUpdater(window: BrowserWindow) {
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
