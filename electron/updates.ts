import { app, BrowserWindow, dialog, net, shell } from 'electron';
import { execFile, spawn } from 'child_process';
import { createHash } from 'crypto';
import { appendFileSync, createWriteStream, existsSync, mkdtempSync, rmSync, writeFileSync, accessSync, constants } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { promisify } from 'util';
import { GITHUB_REPO, RELEASES_URL, isMac, isWindows } from './config';

const run = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// Aggiornamento automatico dell'app desktop.
//
//   1. controlla le release pubbliche su GitHub (avvio + ogni 6 ore)
//   2. scarica in background il pacchetto per questo computer
//   3. verifica l'impronta SHA-256 pubblicata da GitHub (e su Mac la firma)
//   4. "Riavvia per aggiornare" (o alla chiusura dell'app): l'app si chiude,
//      un piccolo aiutante sostituisce il bundle e la riapre.
//
// Sicurezza: il download avviene dentro l'app, quindi macOS non lo mette in
// quarantena e NON serve toglierla; niente token; si installa solo un
// pacchetto con impronta corrispondente e firma valida della nostra app.
// Se l'app non può sostituirsi (es. cartella non scrivibile) si ripiega sul
// download manuale del pacchetto.
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateState = 'idle' | 'downloading' | 'ready' | 'error';

export interface UpdateStatus {
  state: UpdateState;
  version?: string;
  /** 0–100 durante il download. */
  progress?: number;
  /** L'app può installarsi da sola (altrimenti si propone il download manuale). */
  canAutoInstall?: boolean;
  /** Link al pacchetto / alla release, per il ripiego manuale. */
  downloadUrl?: string;
  pageUrl?: string;
  error?: string;
}

interface GithubAsset {
  name: string;
  size: number;
  digest?: string | null;
  browser_download_url: string;
}

interface Release {
  version: string;
  pageUrl: string;
  asset?: GithubAsset; // pacchetto per l'installazione automatica
  manualUrl: string; // pacchetto per il download manuale
}

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const APP_ID = 'it.impresadieffe.preventivi';

let status: UpdateStatus = { state: 'idle' };
let readyPayload: string | null = null; // .app estratto (Mac) o installer (Windows)
let workDir: string | null = null;
let installOnQuit = false;
let busy = false;
let getWin: () => BrowserWindow | null = () => null;

// ─── Utility ────────────────────────────────────────────────────────────────

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}

/** true se `a` è più recente di `b` (MAJOR.MINOR.PATCH). */
export function isNewer(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/** Registro in ~/Library/Application Support/Dieffe Preventivi/updates.log (assistenza). */
function log(message: string) {
  try {
    appendFileSync(join(app.getPath('userData'), 'updates.log'), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // registro non scrivibile: ignora
  }
}

function setStatus(next: UpdateStatus) {
  if (next.state !== status.state || next.version !== status.version) {
    log(`stato ${next.state}${next.version ? ` ${next.version}` : ''}${next.error ? ` — ${next.error}` : ''}`);
  }
  status = next;
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('update-status', status);
}

export function getUpdateStatus(): UpdateStatus {
  return status;
}

/** Percorso del bundle .app in esecuzione (macOS). */
function currentAppBundle(): string | null {
  const m = process.execPath.match(/^(.*?\.app)\//);
  return m ? m[1] : null;
}

/** L'app può sostituirsi da sola su questo computer? */
function canAutoInstall(): boolean {
  if (app.isPackaged === false) return false;
  try {
    if (isMac) {
      const bundle = currentAppBundle();
      // App aperta direttamente dal DMG o "traslocata" da Gatekeeper: sola lettura.
      if (!bundle || bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')) return false;
      accessSync(dirname(bundle), constants.W_OK);
      accessSync(bundle, constants.W_OK);
      return true;
    }
    if (isWindows) return true; // l'installer NSIS è per-utente: non servono permessi admin
  } catch {
    return false;
  }
  return false;
}

// ─── Release ────────────────────────────────────────────────────────────────

async function fetchLatestRelease(): Promise<Release | null> {
  const res = await net.fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DieffePreventivi-Desktop' },
  });
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const rel = (await res.json()) as { tag_name: string; html_url: string; assets: GithubAsset[] };
  const version = rel.tag_name.replace(/^v/, '');
  if (!isNewer(version, app.getVersion())) return null;

  const assets = rel.assets ?? [];
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  let asset: GithubAsset | undefined;
  let manual: GithubAsset | undefined;
  if (isMac) {
    asset = assets.find((a) => a.name === `Dieffe-Preventivi-mac-${arch}.zip`);
    manual = assets.find((a) => a.name === `Dieffe-Preventivi-mac-${arch}.dmg`);
  } else if (isWindows) {
    asset = assets.find((a) => /setup.*\.exe$/i.test(a.name));
    manual = asset;
  }
  return {
    version,
    pageUrl: rel.html_url ?? RELEASES_URL,
    asset,
    manualUrl: manual?.browser_download_url ?? rel.html_url ?? RELEASES_URL,
  };
}

// ─── Download + verifica ────────────────────────────────────────────────────

async function download(asset: GithubAsset, dest: string, version: string) {
  const res = await net.fetch(asset.browser_download_url, { headers: { 'User-Agent': 'DieffePreventivi-Desktop' } });
  if (!res.ok || !res.body) throw new Error(`download HTTP ${res.status}`);

  const total = asset.size || Number(res.headers.get('content-length')) || 0;
  const hash = createHash('sha256');
  const out = createWriteStream(dest);
  const reader = res.body.getReader();
  let received = 0;
  let lastPct = -1;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.length;
      if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()));
      const pct = total ? Math.min(99, Math.floor((received / total) * 100)) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        setStatus({ ...status, state: 'downloading', version, progress: pct });
      }
    }
  } finally {
    await new Promise<void>((r) => out.end(r));
  }

  const expected = asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : null;
  const actual = hash.digest('hex');
  if (expected && expected !== actual) throw new Error('impronta SHA-256 non corrispondente');
  if (total && received !== total) throw new Error('download incompleto');
}

/** Estrae lo zip e verifica che sia davvero la nostra app, con firma integra. */
async function prepareMacBundle(zip: string, dir: string): Promise<string> {
  const extractDir = join(dir, 'app');
  await run('/usr/bin/ditto', ['-x', '-k', zip, extractDir]);
  const bundle = join(extractDir, 'Dieffe Preventivi.app');
  if (!existsSync(bundle)) throw new Error('pacchetto non valido');
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
  const { stderr } = await run('/usr/bin/codesign', ['-dv', bundle]).catch((e) => e);
  if (!String(stderr).includes(`Identifier=${APP_ID}`)) throw new Error('firma non riconosciuta');
  return bundle;
}

async function downloadAndPrepare(release: Release) {
  if (busy || !release.asset) return;
  busy = true;
  try {
    cleanup();
    workDir = mkdtempSync(join(tmpdir(), 'dieffe-update-'));
    const file = join(workDir, release.asset.name);
    setStatus({ state: 'downloading', version: release.version, progress: 0, canAutoInstall: true, pageUrl: release.pageUrl, downloadUrl: release.manualUrl });
    await download(release.asset, file, release.version);
    readyPayload = isMac ? await prepareMacBundle(file, workDir) : file;
    installOnQuit = true;
    setStatus({ state: 'ready', version: release.version, progress: 100, canAutoInstall: true, pageUrl: release.pageUrl, downloadUrl: release.manualUrl });
  } catch (err) {
    cleanup();
    setStatus({
      state: 'error',
      version: release.version,
      canAutoInstall: false,
      downloadUrl: release.manualUrl,
      pageUrl: release.pageUrl,
      error: (err as Error).message,
    });
  } finally {
    busy = false;
  }
}

function cleanup() {
  readyPayload = null;
  installOnQuit = false;
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = null;
}

// ─── Installazione ──────────────────────────────────────────────────────────

/**
 * Avvia l'aiutante che, appena l'app è chiusa, sostituisce il bundle e (se
 * richiesto) la riapre. In caso di errore ripristina la versione precedente.
 */
function spawnMacInstaller(newBundle: string, relaunch: boolean): boolean {
  const target = currentAppBundle();
  if (!target || !workDir) return false;
  const script = join(workDir, 'install.sh');
  writeFileSync(
    script,
    `#!/bin/bash
# Aiutante di aggiornamento Dieffe Preventivi: attende la chiusura dell'app,
# sostituisce il bundle e la riapre. In caso di errore ripristina il vecchio.
PID="$1"; NEW="$2"; TARGET="$3"; RELAUNCH="$4"; WORK="$5"
for i in $(seq 1 300); do kill -0 "$PID" 2>/dev/null || break; sleep 0.1; done
BACKUP="$WORK/previous.app"
if mv "$TARGET" "$BACKUP" 2>/dev/null; then
  if mv "$NEW" "$TARGET" 2>/dev/null || /usr/bin/ditto "$NEW" "$TARGET"; then
    rm -rf "$BACKUP"
  else
    rm -rf "$TARGET"; mv "$BACKUP" "$TARGET"
  fi
fi
[ "$RELAUNCH" = "1" ] && /usr/bin/open "$TARGET"
rm -rf "$WORK"
`,
    { mode: 0o755 }
  );
  const child = spawn('/bin/bash', [script, String(process.pid), newBundle, target, relaunch ? '1' : '0', workDir], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return true;
}

function spawnWindowsInstaller(installer: string, relaunch: boolean): boolean {
  // Installer NSIS di electron-builder: /S = silenzioso, --force-run = riapre l'app.
  const args = ['/S', ...(relaunch ? ['--force-run'] : [])];
  const child = spawn(installer, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}

function startInstall(relaunch: boolean): boolean {
  if (!readyPayload) return false;
  log(`installazione avviata (riapertura: ${relaunch})`);
  const ok = isMac ? spawnMacInstaller(readyPayload, relaunch) : isWindows ? spawnWindowsInstaller(readyPayload, relaunch) : false;
  if (ok) {
    // Da qui in poi i file temporanei li gestisce l'aiutante.
    readyPayload = null;
    installOnQuit = false;
    workDir = null;
  }
  return ok;
}

/** "Riavvia per aggiornare". */
export function quitAndInstall() {
  if (startInstall(true)) app.quit();
}

/** Chiamato all'uscita: se l'aggiornamento è pronto lo installa senza riaprire. */
export function installOnQuitIfReady() {
  if (installOnQuit) startInstall(false);
}

// ─── Controlli ──────────────────────────────────────────────────────────────

async function check(): Promise<Release | null> {
  const release = await fetchLatestRelease();
  if (!release) return null;
  if (status.version === release.version && (status.state === 'downloading' || status.state === 'ready')) return release;

  if (release.asset && canAutoInstall()) {
    void downloadAndPrepare(release);
  } else {
    setStatus({ state: 'error', version: release.version, canAutoInstall: false, downloadUrl: release.manualUrl, pageUrl: release.pageUrl });
  }
  return release;
}

/** Controllo silenzioso all'avvio e poi periodico. */
export function startUpdateChecks(getWindow: () => BrowserWindow | null) {
  getWin = getWindow;
  const tick = () =>
    check()
      .then((r) => log(r ? `trovata ${r.version} (auto: ${!!r.asset && canAutoInstall()})` : `nessun aggiornamento (attuale ${app.getVersion()})`))
      .catch((e) => log(`controllo fallito: ${(e as Error).message}`));
  setTimeout(tick, 8000);
  setInterval(tick, CHECK_EVERY_MS);
}

/** Voce di menu "Controlla aggiornamenti…": risposta sempre esplicita. */
export async function checkForUpdatesInteractive(win: BrowserWindow | null) {
  const opts = (o: Electron.MessageBoxOptions) => (win ? dialog.showMessageBox(win, o) : dialog.showMessageBox(o));

  if (status.state === 'ready') {
    const { response } = await opts({
      type: 'info',
      message: `Dieffe Preventivi ${status.version} è pronta`,
      detail: 'L’aggiornamento è già stato scaricato. Riavvia l’app per completarlo.',
      buttons: ['Riavvia ora', 'Più tardi'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) quitAndInstall();
    return;
  }

  let release: Release | null;
  try {
    release = await check();
  } catch {
    await opts({ type: 'warning', message: 'Impossibile controllare gli aggiornamenti', detail: 'Verifica la connessione a Internet e riprova.', buttons: ['OK'] });
    return;
  }

  if (!release) {
    await opts({ type: 'info', message: 'Dieffe Preventivi è aggiornata', detail: `Stai usando la versione più recente (${app.getVersion()}).`, buttons: ['OK'] });
    return;
  }

  if (status.state === 'downloading') {
    await opts({
      type: 'info',
      message: `Sto scaricando Dieffe Preventivi ${release.version}`,
      detail: 'Al termine comparirà «Riavvia per aggiornare». Puoi continuare a lavorare.',
      buttons: ['OK'],
    });
    return;
  }

  // L'app non può aggiornarsi da sola qui: download manuale.
  const { response } = await opts({
    type: 'info',
    message: `È disponibile Dieffe Preventivi ${release.version}`,
    detail: 'Questa copia dell’app non può aggiornarsi da sola (spostala nella cartella Applicazioni). Puoi scaricare il pacchetto manualmente.',
    buttons: ['Scarica', 'Più tardi'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) shell.openExternal(release.manualUrl);
}
