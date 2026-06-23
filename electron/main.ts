import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron';
import { join } from 'path';
import Store from 'electron-store';
import { setupOfflineCache } from './offline';
import { setupAutoUpdater, installUpdate } from './updater';

const store = new Store();
// In sviluppo l'app NON è pacchettizzata: idioma Electron più affidabile di NODE_ENV.
const isDev = !app.isPackaged;
const NEXT_URL = isDev ? 'http://localhost:3847' : 'https://dieffe-preventivi.vercel.app';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Dimensioni salvate dalla sessione precedente
  const windowBounds = store.get('windowBounds', {
    width: 1280,
    height: 800,
    x: undefined,
    y: undefined,
  }) as { width: number; height: number; x?: number; y?: number };

  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 800,
    minHeight: 600,
    title: 'Dieffe Preventivi',
    // Icona app
    icon: join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    // Title bar nativa standard: aggiunge in alto una barra trascinabile e tiene i
    // semafori (rosso/giallo/verde) nel loro spazio, senza sovrapporsi al contenuto.
    // (hiddenInset li faceva finire sopra logo/testi della web app caricata.)
    titleBarStyle: 'default',
    backgroundColor: '#ffffff',
    show: false, // mostra solo quando pronto
  });

  // Carica l'app
  mainWindow.loadURL(NEXT_URL);

  // Mostra finestra quando pronta (evita flash bianco)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Controlla aggiornamenti (solo in produzione)
    if (!isDev) {
      setupAutoUpdater(mainWindow!);
    }
  });

  // Salva dimensioni finestra
  mainWindow.on('close', () => {
    if (mainWindow) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  // Link esterni si aprono nel browser di sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') && !url.includes('dieffe-preventivi.vercel.app')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Gestione offline
  setupOfflineCache(mainWindow);
}

// Menu applicazione macOS
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Dieffe Preventivi',
      submenu: [
        { label: 'Informazioni su Dieffe Preventivi', role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferenze...',
          accelerator: 'Cmd+,',
          click: () => {
            mainWindow?.loadURL(`${NEXT_URL}/impostazioni`);
          },
        },
        { type: 'separator' },
        { label: 'Nascondi', role: 'hide' },
        { label: 'Nascondi altre', role: 'hideOthers' },
        { type: 'separator' },
        { label: 'Esci', role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Nuovo preventivo',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.loadURL(`${NEXT_URL}/preventivi/nuovo`);
          },
        },
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            mainWindow?.loadURL(`${NEXT_URL}/dashboard`);
          },
        },
        { type: 'separator' },
        { label: 'Chiudi finestra', role: 'close' },
      ],
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo', label: 'Annulla' },
        { role: 'redo', label: 'Ripristina' },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'selectAll', label: 'Seleziona tutto' },
      ],
    },
    {
      label: 'Visualizza',
      submenu: [
        { role: 'reload', label: 'Ricarica' },
        { role: 'toggleDevTools', label: 'Strumenti sviluppatore' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Dimensione originale' },
        { role: 'zoomIn', label: 'Ingrandisci' },
        { role: 'zoomOut', label: 'Riduci' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' },
      ],
    },
    {
      label: 'Finestra',
      submenu: [
        { role: 'minimize', label: 'Minimizza' },
        { role: 'zoom', label: 'Zoom' },
        { type: 'separator' },
        { role: 'front', label: 'Porta in primo piano' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url: string) => shell.openExternal(url));
ipcMain.handle('get-platform', () => process.platform);

// Riavvio per installare l'aggiornamento scaricato (richiesto dal preload).
// Su macOS usa l'updater custom (swap del bundle), su Windows electron-updater.
ipcMain.on('install-update', () => {
  installUpdate();
});
