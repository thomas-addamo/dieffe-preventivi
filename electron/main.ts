import { app, BrowserWindow, ipcMain, nativeTheme, net, session, shell } from 'electron';
import { join } from 'path';
import {
  APP_URL,
  RELEASES_URL,
  SHELL_PLATFORM,
  START_PATH,
  WEBSITE_URL,
  isAppUrl,
  isDev,
  isMac,
  isWindows,
} from './config';
import { loadWindowState, trackWindowState } from './window-state';
import { buildAppMenu, navigate } from './menu';
import { attachContextMenu } from './context-menu';
import { checkForUpdatesInteractive, getKnownUpdate, startUpdateChecks } from './updates';

// ─────────────────────────────────────────────────────────────────────────────
// Dieffe Preventivi — app desktop (macOS / Windows)
//
// Wrapper della web app pubblicata. Aggiunge ciò che il browser non può dare:
// finestra nativa con barra integrata e materiali di sistema (vibrancy su
// macOS, Mica su Windows 11), menu e scorciatoie, menu contestuale, badge
// nel Dock, dialog di sistema, pagina offline.
//
// La web app riconosce questa shell dallo User-Agent ("DieffeDesktop/x.y.z
// (mac|win)") e applica il proprio design desktop (vedi globals.css).
// ─────────────────────────────────────────────────────────────────────────────

app.setName('Dieffe Preventivi');
app.userAgentFallback = `${app.userAgentFallback} DieffeDesktop/${app.getVersion()} (${SHELL_PLATFORM})`;

let mainWindow: BrowserWindow | null = null;
const getWindow = () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);

// Una sola istanza: un secondo avvio riporta in primo piano la finestra esistente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', () => {
  const win = getWindow();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

function offlinePageUrl(target: string) {
  const file = join(__dirname, 'offline.html');
  return `file://${file}?target=${encodeURIComponent(target)}`;
}

function createWindow() {
  const state = loadWindowState();

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    // Sotto i 1024px la web app passa al layout da telefono: non serve in una finestra desktop.
    minWidth: 1040,
    minHeight: 640,
    title: 'Dieffe Preventivi',
    show: false,
    ...(isMac
      ? {
          // Barra del titolo integrata: i semafori stanno nella sidebar, come in Note/Mail.
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 18, y: 18 },
          // Materiale di sistema dietro la sidebar (NSVisualEffectView).
          vibrancy: 'sidebar' as const,
          visualEffectState: 'followWindow' as const,
          backgroundColor: '#00000000',
        }
      : {
          backgroundMaterial: 'mica' as const,
          backgroundColor: '#f7f8fa',
          autoHideMenuBar: false,
          icon: join(__dirname, 'icon.png'),
        }),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
      plugins: true, // visore PDF integrato
    },
  });
  mainWindow = win;

  if (state.maximized) win.maximize();
  trackWindowState(win);
  attachContextMenu(win);

  win.loadURL(new URL(START_PATH, APP_URL).toString());
  win.once('ready-to-show', () => win.show());

  // Rete assente o server irraggiungibile → pagina offline locale (con riprova automatica).
  win.webContents.on('did-fail-load', (_e, errorCode, _desc, validatedURL, isMainFrame) => {
    // -3 = navigazione annullata (normale durante i redirect)
    if (!isMainFrame || errorCode === -3 || !validatedURL.startsWith('http')) return;
    win.loadURL(offlinePageUrl(validatedURL));
  });

  // Dopo ogni caricamento ripropone l'eventuale aggiornamento già trovato.
  win.webContents.on('did-finish-load', () => {
    const update = getKnownUpdate();
    if (update) win.webContents.send('update-available', update);
  });

  // Navigazione: dentro l'app solo la web app; tutto il resto nel browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url) || url.startsWith('file://')) return;
    event.preventDefault();
    if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Anteprime della web app (es. PDF): finestra figlia standard.
    if (isAppUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 980,
          height: 860,
          titleBarStyle: 'default',
          vibrancy: undefined,
          backgroundColor: '#ffffff',
          // plugins: visore PDF integrato di Chromium
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, plugins: true },
        },
      };
    }
    if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Gesti di navigazione: swipe a due dita (Mac) e tasti avanti/indietro del mouse (Windows).
  win.on('swipe', (_e, direction) => {
    const history = win.webContents.navigationHistory;
    if (direction === 'right' && history.canGoBack()) history.goBack();
    if (direction === 'left' && history.canGoForward()) history.goForward();
  });
  win.on('app-command', (_e, cmd) => {
    const history = win.webContents.navigationHistory;
    if (cmd === 'browser-backward' && history.canGoBack()) history.goBack();
    if (cmd === 'browser-forward' && history.canGoForward()) history.goForward();
  });

  // Stato connessione per il banner offline della web app.
  let online = net.isOnline();
  const poll = setInterval(() => {
    const now = net.isOnline();
    if (now !== online) {
      online = now;
      win.webContents.send('online-status-changed', online);
    }
  }, 5000);

  win.on('closed', () => {
    clearInterval(poll);
    if (mainWindow === win) mainWindow = null;
  });
}

function configureSession() {
  const ses = session.defaultSession;

  // Permessi minimi: notifiche, appunti in scrittura e schermo intero.
  const allowed = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen']);
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    callback(allowed.has(permission) && isAppUrl(wc.getURL()));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && isAppUrl(origin));

  // macOS usa il correttore di sistema; su Windows impostiamo l'italiano.
  if (!isMac) ses.setSpellCheckerLanguages(['it-IT']);
}

app.setAboutPanelOptions({
  applicationName: 'Dieffe Preventivi',
  applicationVersion: app.getVersion(),
  version: '',
  copyright: `© ${new Date().getFullYear()} Dieffe Ristrutturazioni`,
  credits: 'Gestione preventivi edili.',
  website: WEBSITE_URL,
});

app.whenReady().then(() => {
  if (isWindows) app.setAppUserModelId('it.impresadieffe.preventivi');
  configureSession();
  buildAppMenu(getWindow);
  createWindow();
  if (!isDev) startUpdateChecks(getWindow);

  app.on('activate', () => {
    if (!getWindow()) createWindow();
    else getWindow()!.show();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

// ─── IPC (vedi preload.ts) ───────────────────────────────────────────────────

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);

// Solo protocolli sicuri: la pagina non può far aprire file o app arbitrarie.
ipcMain.handle('open-external', (_e, url: unknown) => {
  if (typeof url === 'string' && /^(https?|mailto|tel):/.test(url)) return shell.openExternal(url);
});

// Tema scelto nella web app → materiali e controlli nativi coerenti.
ipcMain.on('set-theme', (_e, theme: unknown) => {
  if (theme === 'light' || theme === 'dark' || theme === 'system') nativeTheme.themeSource = theme;
});

// Notifiche non lette → badge sull'icona del Dock / barra applicazioni.
ipcMain.on('set-badge-count', (_e, count: unknown) => {
  const n = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  app.setBadgeCount(n);
});

ipcMain.handle('check-for-updates', () => checkForUpdatesInteractive(getWindow()));
ipcMain.handle('get-known-update', () => getKnownUpdate());
ipcMain.on('open-releases', () => shell.openExternal(RELEASES_URL));

// Usato dai menu quando la pagina chiede di aprire una sezione.
ipcMain.on('navigate', (_e, path: unknown) => {
  if (typeof path === 'string' && path.startsWith('/')) navigate(getWindow(), path);
});
