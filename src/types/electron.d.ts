// Tipi globali per il bridge Electron esposto da electron/preload.ts.
// Necessario qui (oltre che nel preload) perché il build Next esclude la cartella
// electron/ e altrimenti non vedrebbe il tipo di window.electron usato negli hook.

export interface ElectronBridge {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  onOnlineStatus: (callback: (isOnline: boolean) => void) => () => void;
  onUpdateAvailable: (callback: () => void) => () => void;
  onUpdateDownloaded: (callback: () => void) => () => void;
  installUpdate: () => void;
  isElectron: boolean;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

export {};
