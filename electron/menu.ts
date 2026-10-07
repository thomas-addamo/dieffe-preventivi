import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { APP_URL, RELEASES_URL, WEBSITE_URL, isDev, isMac } from './config';
import { checkForUpdatesInteractive } from './updates';

// Menu dell'applicazione (barra dei menu macOS / menu finestra Windows).
// Usa i "role" nativi dove esistono: voci, scorciatoie e traduzioni li
// fornisce il sistema, esattamente come nelle app Apple.

type GetWindow = () => BrowserWindow | null;

/**
 * Naviga dentro la web app senza ricaricarla: la pagina riceve l'evento e
 * usa il router client. Se la pagina non risponde (es. pagina offline),
 * ripiega su un caricamento completo.
 */
export function navigate(win: BrowserWindow | null, path: string) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.webContents
    .executeJavaScript('typeof window.__dieffeNavigate === "function"', true)
    .then((ok) => {
      if (ok) win.webContents.send('navigate', path);
      else win.loadURL(new URL(path, APP_URL).toString());
    })
    .catch(() => win.loadURL(new URL(path, APP_URL).toString()));
}

const GO_TO: { label: string; path: string; key: string }[] = [
  { label: 'Dashboard', path: '/dashboard', key: '1' },
  { label: 'Preventivi', path: '/preventivi', key: '2' },
  { label: 'Lavori extra', path: '/lavori-extra', key: '3' },
  { label: 'Clienti', path: '/clienti', key: '4' },
  { label: 'Crea comunicazione', path: '/comunicazioni', key: '5' },
  { label: 'Listino', path: '/listino', key: '6' },
  { label: 'Statistiche', path: '/statistiche', key: '7' },
  { label: 'Cestino', path: '/cestino', key: '8' },
  { label: 'Profilo', path: '/profilo', key: '9' },
];

const ADMIN_PAGES: { label: string; path: string }[] = [
  { label: 'Utenti', path: '/utenti' },
  { label: 'Invia notifica', path: '/admin/notifiche' },
  { label: 'Audit log', path: '/admin/audit-log' },
  { label: 'Sessioni attive', path: '/admin/sessioni' },
];

/** Pagina corrente della web app (per i comandi che agiscono "qui"). */
function currentPath(win: BrowserWindow | null): string {
  try {
    const url = new URL(win?.webContents.getURL() ?? '');
    if (url.origin === new URL(APP_URL).origin) return url.pathname;
  } catch {
    /* pagina offline o non ancora caricata */
  }
  return '/dashboard';
}

const QUOTE_PAGE = /^\/preventivi\/(?!nuovo$)[^/]+$/;

export function buildAppMenu(getWindow: GetWindow) {
  const go = (path: string) => () => navigate(getWindow(), path);
  // Comando per una pagina: la pagina esegue l'azione letta dal parametro
  // (es. /clienti?nuovo=1) e poi lo toglie dall'indirizzo.
  const goWith = (path: string, param: string, value = '1') => () =>
    navigate(getWindow(), `${path}?${param}=${encodeURIComponent(value)}`);
  // Comando sulla pagina corrente (tema, barra laterale, Aiuto…).
  const here = (param: string, value = '1') => () =>
    navigate(getWindow(), `${currentPath(getWindow())}?${param}=${encodeURIComponent(value)}`);
  // Comando valido solo dentro un preventivo aperto.
  const onQuote = (param: string, value = '1', fallback?: () => void) => () => {
    const path = currentPath(getWindow());
    if (QUOTE_PAGE.test(path)) navigate(getWindow(), `${path}?${param}=${encodeURIComponent(value)}`);
    else if (fallback) fallback();
    else shell.beep();
  };

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `Informazioni su ${app.name}` },
      { label: 'Novità di questa versione', click: here('novita') },
      { label: 'Controlla aggiornamenti…', click: () => checkForUpdatesInteractive(getWindow()) },
      { type: 'separator' },
      { label: 'Impostazioni…', accelerator: 'Cmd+,', click: go('/impostazioni') },
      { label: 'Profilo', click: go('/profilo') },
      { type: 'separator' },
      { role: 'services', label: 'Servizi' },
      { type: 'separator' },
      { role: 'hide', label: `Nascondi ${app.name}` },
      { role: 'hideOthers', label: 'Nascondi altre' },
      { role: 'unhide', label: 'Mostra tutte' },
      { type: 'separator' },
      { role: 'quit', label: `Esci da ${app.name}` },
    ],
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      { label: 'Nuovo preventivo', accelerator: 'CmdOrCtrl+N', click: go('/preventivi/nuovo') },
      {
        label: 'Nuovo lavoro extra…',
        accelerator: 'Shift+CmdOrCtrl+N',
        // Dentro un preventivo: extra di quel preventivo; altrove: scegli il preventivo.
        click: onQuote('extra', '1', goWith('/lavori-extra', 'nuovo')),
      },
      { label: 'Nuova comunicazione', accelerator: 'Alt+CmdOrCtrl+N', click: goWith('/comunicazioni', 'nuova') },
      { label: 'Nuovo cliente', click: goWith('/clienti', 'nuovo') },
      { label: 'Nuova voce di listino', click: goWith('/listino', 'nuovo') },
      { type: 'separator' },
      { label: 'Importa preventivo da file…', accelerator: 'CmdOrCtrl+O', click: goWith('/dashboard', 'importa') },
      { type: 'separator' },
      { label: 'Anteprima PDF del preventivo', accelerator: 'CmdOrCtrl+E', click: onQuote('pdf', 'anteprima') },
      { label: 'Scarica PDF del preventivo', accelerator: 'Shift+CmdOrCtrl+E', click: onQuote('pdf', 'scarica') },
      { type: 'separator' },
      ...(isMac
        ? [{ role: 'close', label: 'Chiudi finestra' } as MenuItemConstructorOptions]
        : [
            { label: 'Impostazioni', accelerator: 'Ctrl+,', click: go('/impostazioni') } as MenuItemConstructorOptions,
            { type: 'separator' } as MenuItemConstructorOptions,
            { role: 'quit', label: 'Esci' } as MenuItemConstructorOptions,
          ]),
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: 'Modifica',
    submenu: [
      { role: 'undo', label: 'Annulla' },
      { role: 'redo', label: 'Ripeti' },
      { type: 'separator' },
      { role: 'cut', label: 'Taglia' },
      { role: 'copy', label: 'Copia' },
      { role: 'paste', label: 'Incolla' },
      { role: 'pasteAndMatchStyle', label: 'Incolla e adatta stile' },
      { role: 'delete', label: 'Elimina' },
      { role: 'selectAll', label: 'Seleziona tutto' },
      ...(isMac
        ? ([
            { type: 'separator' },
            {
              label: 'Voce',
              submenu: [
                { role: 'startSpeaking', label: 'Avvia lettura' },
                { role: 'stopSpeaking', label: 'Interrompi lettura' },
              ],
            },
          ] as MenuItemConstructorOptions[])
        : []),
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: 'Vista',
    submenu: [
      { label: 'Mostra/nascondi barra laterale', accelerator: 'Ctrl+CmdOrCtrl+S', click: here('barra') },
      {
        label: 'Aspetto',
        submenu: [
          { label: 'Chiaro', click: here('tema', 'chiaro') },
          { label: 'Scuro', click: here('tema', 'scuro') },
          { label: 'Come il sistema', click: here('tema', 'sistema') },
        ],
      },
      { type: 'separator' },
      { role: 'reload', label: 'Ricarica' },
      { role: 'forceReload', label: 'Ricarica forzata' },
      ...(isDev ? [{ role: 'toggleDevTools', label: 'Strumenti sviluppatore' } as MenuItemConstructorOptions] : []),
      { type: 'separator' },
      { role: 'resetZoom', label: 'Dimensioni reali' },
      { role: 'zoomIn', label: 'Ingrandisci' },
      { role: 'zoomOut', label: 'Riduci' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Entra in modalità a tutto schermo' },
    ],
  };

  const goMenu: MenuItemConstructorOptions = {
    label: 'Vai',
    submenu: [
      {
        label: 'Indietro',
        accelerator: 'CmdOrCtrl+[',
        click: () => getWindow()?.webContents.navigationHistory.goBack(),
      },
      {
        label: 'Avanti',
        accelerator: 'CmdOrCtrl+]',
        click: () => getWindow()?.webContents.navigationHistory.goForward(),
      },
      { type: 'separator' },
      { label: 'Cerca un preventivo…', accelerator: 'CmdOrCtrl+K', click: goWith('/dashboard', 'cerca') },
      { type: 'separator' },
      ...GO_TO.map(
        ({ label, path, key }) =>
          ({ label, accelerator: `CmdOrCtrl+${key}`, click: go(path) }) as MenuItemConstructorOptions
      ),
      { type: 'separator' },
      {
        label: 'Amministrazione',
        submenu: ADMIN_PAGES.map(({ label, path }) => ({ label, click: go(path) })),
      },
      { label: 'Impostazioni', click: go('/impostazioni') },
    ],
  };

  const toolsMenu: MenuItemConstructorOptions = {
    label: 'Strumenti',
    submenu: [
      { label: 'Riordina il listino ora', click: goWith('/listino', 'riordina') },
      { label: 'Ricerca AI nel listino', click: go('/listino') },
      { type: 'separator' },
      { label: 'Statistiche', click: go('/statistiche') },
      { label: 'Archivio comunicazioni', click: go('/comunicazioni') },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    role: 'windowMenu',
    label: 'Finestra',
    submenu: isMac
      ? [
          { role: 'minimize', label: 'Contrai' },
          { role: 'zoom', label: 'Ridimensiona' },
          { type: 'separator' },
          { role: 'front', label: 'Porta tutto in primo piano' },
        ]
      : [
          { role: 'minimize', label: 'Riduci a icona' },
          { role: 'close', label: 'Chiudi' },
        ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    role: 'help',
    label: 'Aiuto',
    submenu: [
      { label: "Chiedi all'assistente…", accelerator: 'Shift+CmdOrCtrl+/', click: here('aiuto', 'assistente') },
      { label: "Scrivi all'amministratore…", click: here('aiuto', 'admin') },
      { label: 'Novità di questa versione', click: here('novita') },
      { type: 'separator' },
      { label: 'Sito di Dieffe Preventivi', click: () => shell.openExternal(WEBSITE_URL) },
      { label: 'Tutte le versioni', click: () => shell.openExternal(RELEASES_URL) },
      ...(isMac
        ? []
        : ([
            { type: 'separator' },
            { label: 'Controlla aggiornamenti…', click: () => checkForUpdatesInteractive(getWindow()) },
            { role: 'about', label: `Informazioni su ${app.name}` },
          ] as MenuItemConstructorOptions[])),
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    goMenu,
    toolsMenu,
    windowMenu,
    helpMenu,
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Menu del Dock (clic destro sull'icona)
  if (isMac && app.dock) {
    app.dock.setMenu(
      Menu.buildFromTemplate([
        { label: 'Nuovo preventivo', click: go('/preventivi/nuovo') },
        { label: 'Nuovo lavoro extra…', click: goWith('/lavori-extra', 'nuovo') },
        { label: 'Nuova comunicazione', click: goWith('/comunicazioni', 'nuova') },
        { type: 'separator' },
        { label: 'Dashboard', click: go('/dashboard') },
        { label: 'Lavori extra', click: go('/lavori-extra') },
        { label: 'Clienti', click: go('/clienti') },
        { label: 'Listino', click: go('/listino') },
      ])
    );
  }
}
