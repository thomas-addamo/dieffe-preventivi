import { app, BrowserWindow, screen } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Posizione/dimensione della finestra tra un avvio e l'altro, in un piccolo
// JSON nella cartella dati dell'app (niente dipendenze esterne).

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

const DEFAULT_STATE: WindowState = { width: 1360, height: 860 };
const file = () => join(app.getPath('userData'), 'window-state.json');

/** La finestra salvata è ancora (almeno in parte) su uno schermo collegato? */
function isVisibleOnSomeDisplay(s: WindowState): boolean {
  if (s.x === undefined || s.y === undefined) return false;
  return screen.getAllDisplays().some(({ workArea: a }) => {
    return s.x! < a.x + a.width - 80 && s.x! + s.width > a.x + 80 && s.y! >= a.y - 10 && s.y! < a.y + a.height - 80;
  });
}

export function loadWindowState(): WindowState {
  try {
    const s = JSON.parse(readFileSync(file(), 'utf8')) as WindowState;
    if (typeof s.width !== 'number' || typeof s.height !== 'number') return DEFAULT_STATE;
    if (!isVisibleOnSomeDisplay(s)) return { width: s.width, height: s.height, maximized: s.maximized };
    return s;
  } catch {
    return DEFAULT_STATE;
  }
}

export function trackWindowState(win: BrowserWindow) {
  let timer: NodeJS.Timeout | null = null;
  const save = () => {
    if (win.isDestroyed()) return;
    const maximized = win.isMaximized() || win.isFullScreen();
    const bounds = maximized ? win.getNormalBounds() : win.getBounds();
    try {
      writeFileSync(file(), JSON.stringify({ ...bounds, maximized }));
    } catch {
      // cartella dati non scrivibile: si riparte dalle dimensioni predefinite
    }
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 400);
  };
  win.on('resize', schedule);
  win.on('move', schedule);
  win.on('close', save);
}
