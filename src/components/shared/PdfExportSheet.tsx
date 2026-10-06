"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, RotateCw, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pannello "PDF pronto" per mobile/tablet.
//
// Su iPhone (soprattutto con l'app installata in Home) aprire il PDF in una
// nuova finestra mostra solo un visualizzatore senza comandi: niente modo di
// salvarlo o inviarlo. Qui il PDF viene generato e scaricato in memoria, poi
// l'utente sceglie con un TAP (necessario per il foglio di condivisione iOS):
// Condividi/Salva su File, Scarica, oppure Apri.

type State =
  | { status: "loading" }
  | { status: "ready"; file: File; blobUrl: string }
  | { status: "error"; message: string };

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^";]+)"?/i.exec(cd);
  return m?.[1] ?? fallback;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True su dispositivi touch: lì serve il pannello invece della nuova scheda. */
export function prefersPdfSheet(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function PdfExportSheet({
  url,
  title,
  onClose,
}: {
  /** Endpoint che restituisce il PDF (stessa origine). */
  url: string;
  title: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let blobUrl: string | null = null;
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal, credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const name = filenameFrom(res, "preventivo.pdf");
        const file = new File([blob], name, { type: "application/pdf" });
        blobUrl = URL.createObjectURL(file);
        setState({ status: "ready", file, blobUrl });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState({ status: "error", message: "Impossibile generare il PDF. Controlla la connessione e riprova." });
      }
    })();

    return () => {
      ctrl.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url, attempt]);

  const canShareFile =
    state.status === "ready" &&
    typeof navigator !== "undefined" &&
    !!navigator.canShare?.({ files: [state.file] });

  async function share() {
    if (state.status !== "ready") return;
    try {
      await navigator.share({ files: [state.file], title });
    } catch (err) {
      // AbortError = l'utente ha chiuso il foglio di condivisione: nessun errore.
      if ((err as Error).name !== "AbortError") download();
    }
  }

  function download() {
    if (state.status !== "ready") return;
    const a = document.createElement("a");
    a.href = state.blobUrl;
    a.download = state.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openPreview() {
    if (state.status !== "ready") return;
    window.open(state.blobUrl, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center">
      <div className="modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Esporta PDF"
        className="sheet-in md:modal-pop relative w-full bg-background rounded-t-sheet md:max-w-sm md:rounded-sheet shadow-xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5"
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/25 md:hidden" />
        <div className="flex items-start gap-3 px-5 pt-5 pr-14">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">
              {state.status === "loading" && "Preparo il PDF…"}
              {state.status === "ready" && "PDF pronto"}
              {state.status === "error" && "Qualcosa è andato storto"}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {state.status === "ready"
                ? `${state.file.name} · ${(state.file.size / 1024).toFixed(0)} KB`
                : state.status === "error"
                  ? state.message
                  : title}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-transform hover:bg-accent active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 px-5">
          {state.status === "loading" && (
            <div className="flex h-12 items-center justify-center gap-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Generazione in corso
            </div>
          )}

          {state.status === "error" && (
            <Button className="h-12 w-full gap-2 rounded-lg" onClick={() => {
                setState({ status: "loading" });
                setAttempt((n) => n + 1);
              }}>
              <RotateCw className="h-4 w-4" /> Riprova
            </Button>
          )}

          {state.status === "ready" && (
            <>
              {canShareFile && (
                <Button className="h-12 w-full gap-2 rounded-lg text-base" onClick={share}>
                  <Share className="h-4 w-4" /> Condividi o salva su File
                </Button>
              )}
              <Button
                variant={canShareFile ? "outline" : "default"}
                className="h-12 w-full gap-2 rounded-lg text-base"
                onClick={download}
              >
                <Download className="h-4 w-4" /> Scarica PDF
              </Button>
              {!isStandalone() && (
                <Button variant="ghost" className="h-11 w-full gap-2 rounded-lg" onClick={openPreview}>
                  <ExternalLink className="h-4 w-4" /> Apri anteprima
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
