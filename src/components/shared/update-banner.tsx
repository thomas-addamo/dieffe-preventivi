'use client';

import { useEffect, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, RotateCw, X } from 'lucide-react';
import { useElectron } from '@/hooks/use-electron';
import type { DesktopUpdateStatus } from '@/types/electron';

/**
 * Aggiornamento dell'app desktop (solo dentro l'app Electron; sul web nulla).
 *
 * App ≥ 3.14: l'aggiornamento si scarica da solo in background, poi
 * "Riavvia per aggiornare" chiude l'app, la sostituisce e la riapre (vedi
 * electron/updates.ts). Se l'app non può aggiornarsi da sola, o con le app
 * 3.13.x, propone il download manuale del pacchetto.
 */
export function UpdateBanner() {
  const { isElectron, electron } = useElectron();
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron || !electron) return;

    // Wrapper con aggiornamento automatico
    if (electron.onUpdateStatus) {
      electron.getUpdateStatus?.().then(setStatus).catch(() => {});
      return electron.onUpdateStatus(setStatus);
    }

    // Wrapper 3.13.x: solo avviso con download manuale
    electron.getKnownUpdate?.()
      .then((k) => k && setStatus({ state: 'error', canAutoInstall: false, ...k }))
      .catch(() => {});
    return electron.onUpdateAvailable((info) => {
      if (info?.version) setStatus({ state: 'error', canAutoInstall: false, ...info });
    });
  }, [isElectron, electron]);

  if (!isElectron || !status || status.state === 'idle' || !status.version) return null;
  if (dismissed === `${status.version}:${status.state}`) return null;

  const ready = status.state === 'ready';
  const downloading = status.state === 'downloading';
  const manual = status.state === 'error';
  const progress = Math.max(0, Math.min(100, status.progress ?? 0));

  return (
    <div
      role="status"
      className="animate-slide-up fixed bottom-4 right-4 z-50 w-[340px] rounded-2xl border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-xl backdrop-blur-xl"
    >
      {/* Radius annidati: card 20px − p-1 (4px) → area interna 16px */}
      <div className="relative flex items-start gap-3 rounded-xl p-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-sm">
          {ready ? <CheckCircle2 className="h-4 w-4" /> : <ArrowDownToLine className={downloading ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />}
        </span>

        <div className="min-w-0 flex-1 pr-5">
          <p className="text-[13px] font-semibold leading-tight">
            {ready ? 'Aggiornamento pronto' : `Dieffe Preventivi ${status.version}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ready && `La versione ${status.version} è scaricata. Riavvia per installarla, oppure si installerà alla chiusura.`}
            {downloading && `Download dell'aggiornamento… ${progress}%`}
            {manual && 'È disponibile una nuova versione dell’app desktop.'}
          </p>

          {downloading && (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}

          {ready && (
            <button
              onClick={() => electron?.installUpdate?.()}
              className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <RotateCw className="h-3.5 w-3.5" /> Riavvia per aggiornare
            </button>
          )}

          {manual && status.downloadUrl && (
            <div className="mt-2.5 flex gap-1.5">
              <button
                onClick={() => electron?.openExternal(status.downloadUrl!)}
                className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                Scarica
              </button>
              {status.pageUrl && (
                <button
                  onClick={() => electron?.openExternal(status.pageUrl!)}
                  className="h-7 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Novità
                </button>
              )}
            </div>
          )}
        </div>

        {!downloading && (
          <button
            onClick={() => setDismissed(`${status.version}:${status.state}`)}
            aria-label="Chiudi"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
