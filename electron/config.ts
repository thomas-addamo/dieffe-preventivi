import { app } from 'electron';

// Configurazione condivisa del wrapper desktop.
//
// L'app desktop NON impacchetta la web app: apre la versione pubblicata
// (sempre aggiornata) e aggiunge l'integrazione col sistema operativo.

/** In sviluppo l'app non è pacchettizzata: idioma Electron più affidabile di NODE_ENV. */
export const isDev = !app.isPackaged;

/** URL della web app. Sovrascrivibile in sviluppo con DIEFFE_APP_URL. */
export const APP_URL =
  (isDev && process.env.DIEFFE_APP_URL) ||
  (isDev ? 'http://localhost:3847' : 'https://dieffe-preventivi.vercel.app');

export const APP_ORIGIN = new URL(APP_URL).origin;

/** Pagina aperta all'avvio (in sviluppo si può puntare a una sandbox). */
export const START_PATH = (isDev && process.env.DIEFFE_START_PATH) || '/dashboard';

/** Repository pubblico da cui vengono distribuite le release. */
export const GITHUB_REPO = 'thomas-addamo/dieffe-preventivi';
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
export const WEBSITE_URL = 'https://dieffe-preventivi.vercel.app';

export const isMac = process.platform === 'darwin';
export const isWindows = process.platform === 'win32';

/** Piattaforma come la vede la web app (data-platform su <html>). */
export const SHELL_PLATFORM = isMac ? 'mac' : isWindows ? 'win' : 'linux';

/** Un URL appartiene alla web app? (tutto il resto si apre nel browser). */
export function isAppUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.origin === APP_ORIGIN || u.protocol === 'blob:' || u.protocol === 'about:';
  } catch {
    return false;
  }
}
