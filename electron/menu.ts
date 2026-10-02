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
  { label: 'Clienti', path: '/clienti', key: '3' },
  { label: 'Listino', path: '/listino', key: '4' },
  { label: 'Template', path: '/template', key: '5' },
  { label: 'Statistiche', path: '/statistiche', key: '6' },
  { label: 'Cestino', path: '/cestino', key: '7' },
];

export function buildAppMenu(getWindow: GetWindow) {
  const go = (path: string) => () => navigate(getWindow(), path);

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `Informazioni su ${app.name}` },
      { label: 'Controlla aggiornamenti…', click: () => checkForUpdatesInteractive(getWindow()) },
      { type: 'separator' },
      { label: 'Impostazioni…', accelerator: 'Cmd+,', click: go('/impostazioni') },
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
      ...GO_TO.map(
        ({ label, path, key }) =>
          ({ label, accelerator: `CmdOrCtrl+${key}`, click: go(path) }) as MenuItemConstructorOptions
      ),
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
    windowMenu,
    helpMenu,
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Menu del Dock (clic destro sull'icona)
  if (isMac && app.dock) {
    app.dock.setMenu(
      Menu.buildFromTemplate([
        { label: 'Nuovo preventivo', click: go('/preventivi/nuovo') },
        { label: 'Preventivi', click: go('/preventivi') },
        { label: 'Clienti', click: go('/clienti') },
      ])
    );
  }
}
