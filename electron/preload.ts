import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// Ponte minimo e tipizzato tra la web app e il sistema (window.electron).
// Tipi lato web in src/types/electron.d.ts — tenerli allineati.

interface UpdateStatus {
  state: 'idle' | 'downloading' | 'ready' | 'error';
  version?: string;
  progress?: number;
  canAutoInstall?: boolean;
  downloadUrl?: string;
  pageUrl?: string;
  error?: string;
}

function on<T extends unknown[]>(channel: string, callback: (...args: T) => void) {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]) => callback(...(args as T));
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const params = navigator.userAgent.match(/DieffeDesktop\/([\d.]+) \((\w+)(?:; (\d+))?\)/);

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  shellVersion: params?.[1] ?? null,
  platform: params?.[2] ?? null,

  getVersion: () => ipcRenderer.invoke('get-app-version') as Promise<string>,
  getPlatform: () => ipcRenderer.invoke('get-platform') as Promise<string>,
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url) as Promise<void>,

  // Connessione
  onOnlineStatus: (callback: (isOnline: boolean) => void) => on('online-status-changed', callback),

  // Aggiornamenti dell'app desktop
  // (download in background → "Riavvia per aggiornare")
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => on('update-status', callback),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status') as Promise<UpdateStatus>,
  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates') as Promise<void>,
  // Compatibilità con la web app pubblicata prima di questa versione
  onUpdateAvailable: (callback: (info: unknown) => void) => on('update-available', callback),
  openReleases: () => ipcRenderer.send('open-releases'),

  // Integrazione sistema
  setTheme: (theme: 'light' | 'dark' | 'system') => ipcRenderer.send('set-theme', theme),
  setBadgeCount: (count: number) => ipcRenderer.send('set-badge-count', count),

  // Navigazione richiesta dai menu nativi (Vai, File, Dock)
  onNavigate: (callback: (path: string) => void) => on('navigate', callback),
});
