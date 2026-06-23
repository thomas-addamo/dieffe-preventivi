import { BrowserWindow, net } from 'electron';

export function setupOfflineCache(window: BrowserWindow) {
  let isOnline = net.isOnline();

  // Monitora connessione ogni 10 secondi
  const checkInterval = setInterval(() => {
    const currentStatus = net.isOnline();
    if (currentStatus !== isOnline) {
      isOnline = currentStatus;
      window.webContents.send('online-status-changed', isOnline);

      if (!isOnline) {
        // Vai alla pagina offline quando perde connessione
        window.webContents.send('connection-lost');
      } else {
        // Ricarica quando torna online
        window.webContents.send('connection-restored');
      }
    }
  }, 10000);

  window.on('closed', () => clearInterval(checkInterval));
}
