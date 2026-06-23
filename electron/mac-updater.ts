// ─────────────────────────────────────────────────────────────────────────────
// Auto-updater CUSTOM per macOS — bypassa Squirrel.Mac (e quindi la firma Apple).
//
// Squirrel.Mac (electron-updater) pretende che l'app sia firmata con un certificato
// Apple per applicare gli aggiornamenti. Qui invece facciamo tutto a mano:
//   1. interroghiamo le Release di GitHub (repo privato → con token incorporato)
//   2. scarichiamo lo zip della nuova versione per l'architettura corrente
//   3. lo estraiamo, rimuoviamo la quarantena, sostituiamo il bundle .app e riavviamo
//
// Nessun certificato, nessun account Apple. L'unico requisito è che l'utente abbia
// permesso di scrittura sulla cartella dove è installata l'app (di norma /Applications
// è scrivibile dagli utenti admin senza password).
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow } from 'electron';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, readdirSync } from 'fs';
import { spawn } from 'child_process';
import { UPDATE_TOKEN } from './update-token';

const OWNER = 'thomas-addamo';
const REPO = 'dieffe-preventivi';

let downloadedAppPath: string | null = null;

/** Confronto versioni MAJOR.MINOR.PATCH: >0 se a è più recente di b. */
function cmpVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function ghFetch(url: string, accept: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `token ${UPDATE_TOKEN}`,
      Accept: accept,
      'User-Agent': 'DieffePreventivi-Updater',
    },
    redirect: 'follow',
  });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: 'ignore' });
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exit ${code}`))));
  });
}

export function setupMacUpdater(window: BrowserWindow) {
  if (!UPDATE_TOKEN) return; // senza token non possiamo leggere le release private
  const check = () =>
    checkAndDownload(window).catch((e) => console.error('[mac-updater]', e));
  check();
  setInterval(check, 60 * 60 * 1000);
}

async function checkAndDownload(window: BrowserWindow) {
  const res = await ghFetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
    'application/vnd.github+json'
  );
  if (!res.ok) throw new Error(`releases/latest HTTP ${res.status}`);
  const rel = (await res.json()) as {
    tag_name: string;
    assets: { name: string; url: string }[];
  };

  if (cmpVersions(rel.tag_name, app.getVersion()) <= 0) return; // già aggiornati

  // Asset .zip per l'architettura corrente (arm64 o Intel x64).
  const isArm = process.arch === 'arm64';
  const asset = rel.assets.find((a) => {
    const n = a.name.toLowerCase();
    if (!n.endsWith('-mac.zip')) return false;
    return isArm ? n.includes('arm64') : !n.includes('arm64');
  });
  if (!asset) throw new Error('asset mac .zip non trovato nella release');

  window.webContents.send('update-available');

  // Scarica lo zip (l'API redirige a S3; fetch segue il redirect).
  const dl = await ghFetch(asset.url, 'application/octet-stream');
  if (!dl.ok) throw new Error(`download HTTP ${dl.status}`);
  const dir = mkdtempSync(join(tmpdir(), 'dieffe-update-'));
  const zipPath = join(dir, 'update.zip');
  writeFileSync(zipPath, Buffer.from(await dl.arrayBuffer()));

  // Estrai con ditto e trova il bundle .app.
  await run('/usr/bin/ditto', ['-x', '-k', zipPath, dir]);
  const appName = readdirSync(dir).find((f) => f.endsWith('.app'));
  if (!appName) throw new Error('.app non trovato nello zip');
  downloadedAppPath = join(dir, appName);

  // Rimuovi la quarantena dal nuovo bundle (evita "app danneggiata").
  await run('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', downloadedAppPath]).catch(
    () => {}
  );

  window.webContents.send('update-downloaded');
}

/** Sostituisce l'app installata con quella scaricata e riavvia. */
export function quitAndInstallMac() {
  if (!downloadedAppPath) return;

  // .../Dieffe Preventivi.app/Contents/MacOS/<exe> → risali al bundle .app
  const currentApp = resolve(process.execPath, '..', '..', '..');

  // Script di swap: attende la chiusura, copia la nuova versione in modo sicuro
  // (prima copia in .new, poi sostituisce), toglie la quarantena e riapre.
  const script = `#!/bin/bash
APP_OLD="$1"
APP_NEW="$2"
# attende la chiusura del processo in esecuzione
for i in $(seq 1 120); do
  pgrep -f "$APP_OLD/Contents/MacOS/" >/dev/null 2>&1 || break
  sleep 0.5
done
rm -rf "$APP_OLD.new"
if cp -R "$APP_NEW" "$APP_OLD.new" 2>/dev/null; then
  rm -rf "$APP_OLD"
  mv "$APP_OLD.new" "$APP_OLD"
fi
xattr -dr com.apple.quarantine "$APP_OLD" 2>/dev/null
open "$APP_OLD"
`;
  const scriptPath = join(tmpdir(), `dieffe-swap-${Date.now()}.sh`);
  writeFileSync(scriptPath, script, { mode: 0o755 });

  spawn('/bin/bash', [scriptPath, currentApp, downloadedAppPath], {
    detached: true,
    stdio: 'ignore',
  }).unref();

  app.quit();
}
