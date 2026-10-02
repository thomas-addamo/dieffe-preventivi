import { app, BrowserWindow, dialog, net, shell } from 'electron';
import { GITHUB_REPO, RELEASES_URL, isMac } from './config';

// Aggiornamenti dell'app desktop.
//
// L'interfaccia si aggiorna da sola (è la web app pubblicata); il wrapper
// cambia di rado. Per questo NON scarichiamo né sostituiamo l'app in
// background: controlliamo le release pubbliche su GitHub e, se ce n'è una
// più recente, proponiamo il download del pacchetto giusto per questo Mac/PC.
// Nessun token, nessuno script che modifica l'app installata.

export interface UpdateInfo {
  version: string;
  /** Link diretto al pacchetto per questa piattaforma/architettura. */
  downloadUrl: string;
  /** Pagina della release (note di rilascio). */
  pageUrl: string;
}

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
let latest: UpdateInfo | null = null;

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}

/** true se `a` è più recente di `b` (semver semplice MAJOR.MINOR.PATCH). */
export function isNewer(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

function pickAsset(assets: GithubAsset[]): GithubAsset | undefined {
  if (isMac) {
    const dmgs = assets.filter((a) => a.name.endsWith('.dmg'));
    return process.arch === 'arm64'
      ? dmgs.find((a) => a.name.includes('arm64'))
      : dmgs.find((a) => !a.name.includes('arm64'));
  }
  return assets.find((a) => /setup.*\.exe$/i.test(a.name)) ?? assets.find((a) => a.name.endsWith('.exe'));
}

export async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  const res = await net.fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DieffePreventivi-Desktop' },
  });
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const rel = (await res.json()) as { tag_name: string; html_url: string; assets: GithubAsset[] };
  const version = rel.tag_name.replace(/^v/, '');
  if (!isNewer(version, app.getVersion())) return null;
  const asset = pickAsset(rel.assets ?? []);
  return {
    version,
    downloadUrl: asset?.browser_download_url ?? rel.html_url ?? RELEASES_URL,
    pageUrl: rel.html_url ?? RELEASES_URL,
  };
}

function notifyRenderer(win: BrowserWindow, info: UpdateInfo) {
  if (!win.isDestroyed()) win.webContents.send('update-available', info);
}

/** Controllo silenzioso all'avvio e poi periodico: avvisa la web app con un banner. */
export function startUpdateChecks(getWindow: () => BrowserWindow | null) {
  const check = async () => {
    try {
      latest = await fetchLatestRelease();
      const win = getWindow();
      if (latest && win) notifyRenderer(win, latest);
    } catch {
      // offline o rate-limit GitHub: si riprova al prossimo giro
    }
  };
  setTimeout(check, 8000);
  setInterval(check, CHECK_EVERY_MS);
}

/** Ultimo aggiornamento noto (per rimandarlo a una pagina appena ricaricata). */
export function getKnownUpdate(): UpdateInfo | null {
  return latest;
}

/** Voce di menu "Controlla aggiornamenti…": risposta sempre esplicita, con dialog nativo. */
export async function checkForUpdatesInteractive(win: BrowserWindow | null) {
  const parent = win ?? undefined;
  try {
    latest = await fetchLatestRelease();
  } catch {
    await dialog.showMessageBox(parent!, {
      type: 'warning',
      message: 'Impossibile controllare gli aggiornamenti',
      detail: 'Verifica la connessione a Internet e riprova.',
      buttons: ['OK'],
    });
    return;
  }

  if (!latest) {
    await dialog.showMessageBox(parent!, {
      type: 'info',
      message: 'Dieffe Preventivi è aggiornata',
      detail: `Stai usando la versione più recente (${app.getVersion()}).`,
      buttons: ['OK'],
    });
    return;
  }

  const { response } = await dialog.showMessageBox(parent!, {
    type: 'info',
    message: `È disponibile Dieffe Preventivi ${latest.version}`,
    detail:
      `Hai la versione ${app.getVersion()}. Scarica il nuovo pacchetto e installalo ` +
      'sostituendo l’app attuale: i tuoi dati restano al sicuro online.',
    buttons: ['Scarica', 'Note di rilascio', 'Più tardi'],
    defaultId: 0,
    cancelId: 2,
  });
  if (response === 0) shell.openExternal(latest.downloadUrl);
  if (response === 1) shell.openExternal(latest.pageUrl);
}
