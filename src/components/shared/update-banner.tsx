'use client';

import { useEffect, useState } from 'react';
import { ArrowDownToLine, X } from 'lucide-react';
import { useElectron } from '@/hooks/use-electron';
import type { DesktopUpdateInfo } from '@/types/electron';

/**
 * Avviso "nuova versione dell'app desktop" (solo dentro l'app Electron).
 * L'app non si sostituisce da sola: propone il download del pacchetto giusto
 * per il computer in uso (vedi electron/updates.ts). Sul web non rende nulla.
 */
export function UpdateBanner() {
  const { isElectron, electron } = useElectron();
  const [info, setInfo] = useState<DesktopUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron || !electron) return;
    electron.getKnownUpdate?.().then((known) => known && setInfo(known)).catch(() => {});
    return electron.onUpdateAvailable((next) => {
      if (next?.version) setInfo(next);
    });
  }, [isElectron, electron]);

  if (!isElectron || !info || dismissed === info.version) return null;

  return (
    <div
      role="status"
      className="animate-slide-up fixed bottom-4 right-4 z-50 w-[340px] rounded-2xl border bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl"
    >
      {/* Radius annidati: contenitore 16px + p-1.5 (6px) → interno 10px */}
      <div className="flex items-start gap-3 rounded-[10px] p-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm">
          <ArrowDownToLine className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight">Dieffe Preventivi {info.version}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            È disponibile una nuova versione dell&apos;app desktop.
          </p>
          <div className="mt-2.5 flex gap-1.5">
            <button
              onClick={() => electron?.openExternal(info.downloadUrl)}
              className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              Scarica
            </button>
            <button
              onClick={() => electron?.openExternal(info.pageUrl)}
              className="h-7 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Novità
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(info.version)}
          aria-label="Chiudi"
          className="-mr-1 -mt-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
