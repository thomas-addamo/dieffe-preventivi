import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // Info app
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Stato connessione
  onOnlineStatus: (callback: (isOnline: boolean) => void) => {
    ipcRenderer.on('online-status-changed', (_, isOnline) => callback(isOnline));
    return () => ipcRenderer.removeAllListeners('online-status-changed');
  },

  // Auto-updater
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback);
    return () => ipcRenderer.removeAllListeners('update-available');
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback);
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  },
  installUpdate: () => ipcRenderer.send('install-update'),

  // Flag per sapere se siamo in Electron
  isElectron: true,
});
