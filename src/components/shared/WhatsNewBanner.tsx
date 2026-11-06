"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Keyboard,
  HardHat,
  LayoutPanelLeft,
  Monitor,
  Settings2,
  ShieldCheck,
  Sparkles,
  Type,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { getWhatsNew, type ChangelogIcon } from "@/lib/changelog";

// Banner "Novità" in cima all'app: solo per gli aggiornamenti importanti
// (`important` in lib/changelog), una volta, e resta chiuso dopo la X per
// questo dispositivo. Si salva la versione vista: chi ha chiuso le novità di
// una versione non rivede quelle più vecchie.

const STORAGE_KEY = "whats_new_dismissed";
const CHANGE_EVENT = "dieffe:whats-new";

const ICONS: Record<ChangelogIcon, LucideIcon> = {
  format: Type,
  pdf: FileText,
  layout: LayoutPanelLeft,
  settings: Settings2,
  sparkles: Sparkles,
  shield: ShieldCheck,
  zap: Zap,
  desktop: Monitor,
  keyboard: Keyboard,
  site: HardHat,
};

function readDismissed(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function WhatsNewBanner() {
  // Sul server "già visto": niente flash del banner prima dell'idratazione.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => APP_VERSION);
  const entry = getWhatsNew(APP_VERSION, dismissed);

  if (!entry) return null;

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } catch {
      // storage non disponibile: si chiude solo per questa sessione di pagina
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const [major, minor] = entry.version.split(".");
  const isMajor = entry.version.endsWith(".0.0");

  return (
    <section aria-label={`Novità della versione ${entry.version}`} className="px-4 pt-4 md:px-6 md:pt-6 lg:px-8">
      <div className="wn-card relative isolate overflow-hidden rounded-sheet bg-[#0a0f1f] text-white shadow-[0_24px_60px_-24px_rgb(15_23_42/0.55)] ring-1 ring-white/10">
        {/* Fondo: luci del marchio, trama a puntini, numero di versione a filo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(60% 80% at 0% 0%, rgb(37 99 235 / 0.45), transparent 60%), radial-gradient(50% 70% at 100% 100%, rgb(124 58 237 / 0.35), transparent 65%), radial-gradient(40% 50% at 70% 10%, rgb(14 165 233 / 0.18), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(rgb(255 255 255 / 0.5) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            maskImage: "radial-gradient(ellipse at 30% 0%, black, transparent 70%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-12 left-[30%] -z-10 hidden select-none font-black leading-none tracking-tighter text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.07)] text-[13rem] lg:block"
        >
          {major}.{minor}
        </span>
        <span aria-hidden className="wn-sheen pointer-events-none absolute inset-y-0 -left-1/3 -z-10 w-1/3" />

        <button
          type="button"
          onClick={close}
          aria-label="Chiudi novità"
          className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-10 lg:p-8">
          {/* Annuncio */}
          <div className="wn-rise flex flex-col pr-8 lg:pr-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-inset ring-white/15 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-300" />
                </span>
                {isMajor ? "Nuova versione" : "Novità"} · v{entry.version}
              </span>
              <span className="text-white/50">{fmtDate(entry.date)}</span>
            </div>

            <h2 className="mt-4 bg-gradient-to-br from-white via-white to-sky-200 bg-clip-text text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.02em] text-transparent sm:text-4xl lg:text-[2.75rem]">
              {entry.headline}
            </h2>
            {isMajor && (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65">
                Dieffe Preventivi {major}.0 è il più grande aggiornamento di sempre: ecco cosa cambia nel lavoro di tutti i giorni.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 lg:mt-auto lg:pt-6">
              {entry.cta && (
                <Link
                  href={entry.cta.href}
                  onClick={close}
                  className="group inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-sky-50 active:scale-[0.98]"
                >
                  {entry.cta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={close}
                className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-white/75 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 hover:text-white"
              >
                Ho capito
              </button>
            </div>
          </div>

          {/* Cosa cambia */}
          <ol className="rounded-[calc(var(--radius-sheet)-12px)] bg-white/[0.04] px-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
            {entry.highlights.map(({ icon, title, description }, i) => {
              const Icon = ICONS[icon] ?? Sparkles;
              return (
                <li
                  key={title}
                  className="wn-rise flex gap-3.5 py-3.5 [&+&]:border-t"
                  // Colore inline: lo stile globale dei bordi prevale sulle utility.
                  style={{ animationDelay: `${120 + i * 90}ms`, borderColor: "rgb(255 255 255 / 0.08)" }}
                >
                  <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/25 to-violet-500/25 ring-1 ring-inset ring-white/15">
                    <Icon className="h-4 w-4 text-sky-200" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2 text-sm font-semibold">
                      <span className="font-mono text-[10px] font-medium text-white/35">{String(i + 1).padStart(2, "0")}</span>
                      {title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white/65">{description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
