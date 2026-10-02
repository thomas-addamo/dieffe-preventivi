"use client";

import { useSyncExternalStore } from "react";
import {
  FileText,
  LayoutPanelLeft,
  Settings2,
  ShieldCheck,
  Sparkles,
  Type,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { getChangelogFor, type ChangelogIcon } from "@/lib/changelog";

// Banner "Novità" in cima all'app: compare una volta per versione (se esiste
// una voce in lib/changelog) e resta chiuso dopo la X, per questo dispositivo.

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
  const entry = getChangelogFor(APP_VERSION);
  // Sul server "già visto": niente flash del banner prima dell'idratazione.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => APP_VERSION);

  if (!entry || dismissed === APP_VERSION) return null;

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } catch {
      // storage non disponibile: si chiude solo per questa sessione di pagina
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <section
      aria-label={`Novità della versione ${entry.version}`}
      className="animate-slide-up px-3 pt-3 lg:px-6 lg:pt-4"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#4c1d95] text-white shadow-lg ring-1 ring-white/10">
        {/* Decorazioni: aloni luminosi + griglia sottile */}
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-400/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />

        <button
          type="button"
          onClick={close}
          aria-label="Chiudi novità"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:gap-8 lg:p-7">
          {/* Titolo */}
          <div className="shrink-0 pr-10 lg:w-72 lg:pr-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-white/20">
                <Sparkles className="h-3 w-3 text-amber-300" /> Aggiornamento
              </span>
              <span className="text-[11px] text-white/60">{fmtDate(entry.date)}</span>
            </div>
            <h2 className="mt-3 flex items-baseline gap-3 font-bold leading-none tracking-tight">
              <span className="text-[2.5rem] lg:text-5xl">Novità</span>
              <span className="rounded-lg bg-gradient-to-r from-amber-300 to-orange-400 px-2 py-1 text-base font-extrabold text-slate-900 shadow-sm lg:text-lg">
                v{entry.version}
              </span>
            </h2>
            <p className="mt-2 text-sm text-white/75 lg:mt-3">{entry.headline}</p>
          </div>

          {/* Miglioramenti */}
          {/* Mobile: carosello orizzontale (snap); da sm in su: griglia */}
          <ul className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:flex-1 sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
            {entry.highlights.map(({ icon, title, description }) => {
              const Icon = ICONS[icon];
              return (
                <li
                  key={title}
                  className="group w-[72%] shrink-0 snap-start rounded-xl bg-white/[0.07] p-3.5 sm:w-auto ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/[0.12]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 shadow-md shadow-indigo-900/40 transition group-hover:scale-105">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-2.5 text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/70">{description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
