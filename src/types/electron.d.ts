// Tipi globali per il bridge Electron esposto da electron/preload.ts.
// Necessario qui (oltre che nel preload) perché il build Next esclude la cartella
// electron/ e altrimenti non vedrebbe il tipo di window.electron usato negli hook.
//
// I metodi marcati opzionali non esistono nelle app desktop ≤ 3.12 (wrapper
// precedente): la web app deve sempre controllarne la presenza.

export interface DesktopUpdateInfo {
  version: string;
  downloadUrl: string;
  pageUrl: string;
}

/** Stato dell'aggiornamento automatico (wrapper ≥ 3.14). */
export interface DesktopUpdateStatus {
  state: "idle" | "downloading" | "ready" | "error";
  version?: string;
  progress?: number;
  canAutoInstall?: boolean;
  downloadUrl?: string;
  pageUrl?: string;
  error?: string;
}

export interface ElectronBridge {
  isElectron: boolean;
  shellVersion?: string | null;
  platform?: "mac" | "win" | "linux" | null;
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  onOnlineStatus: (callback: (isOnline: boolean) => void) => () => void;
  onUpdateAvailable: (callback: (info?: DesktopUpdateInfo) => void) => () => void;
  getKnownUpdate?: () => Promise<DesktopUpdateInfo | null>;
  onUpdateStatus?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
  getUpdateStatus?: () => Promise<DesktopUpdateStatus>;
  installUpdate?: () => void;
  checkForUpdates?: () => Promise<void>;
  openReleases?: () => void;
  setTheme?: (theme: "light" | "dark" | "system") => void;
  setBadgeCount?: (count: number) => void;
  onNavigate?: (callback: (path: string) => void) => () => void;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
    /** Presente quando la pagina accetta navigazioni dai menu nativi. */
    __dieffeNavigate?: () => void;
  }
}

export {};
