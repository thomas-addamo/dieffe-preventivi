"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, FileText, PartyPopper, Send, Sparkles } from "lucide-react";
import type { BriefingItem, BriefingResponse } from "@/app/api/ai/briefing/route";
import { cn } from "@/lib/utils";

// Benvenuto personalizzato in cima alla dashboard: saluto in base all'ora,
// messaggio e consigli dell'AI, e cosa è rimasto in sospeso per l'utente.
// Il testo dell'AI resta in cache nel browser per fascia oraria: l'AI viene
// chiamata al massimo 4 volte al giorno per utente e nulla va nel database.

type Slot = "notte" | "mattina" | "pomeriggio" | "sera";

function slotOf(hour: number): Slot {
  if (hour < 5) return "notte";
  if (hour < 13) return "mattina";
  if (hour < 18) return "pomeriggio";
  return "sera";
}

function greeting(hour: number): string {
  if (hour < 5) return "Buonanotte";
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

const REASON: Record<BriefingItem["reason"], { label: (d: number) => string; icon: typeof FileText; cls: string }> = {
  draft: {
    label: (d) => (d === 0 ? "Bozza modificata oggi" : `Bozza ferma da ${d} giorn${d === 1 ? "o" : "i"}`),
    icon: FileText,
    cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  followup: {
    label: (d) => `Inviato ${d} giorni fa, senza risposta`,
    icon: Send,
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  signed: {
    label: () => "Accettato questa settimana",
    icon: PartyPopper,
    cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
};

function readCache(key: string): BriefingResponse["ai"] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as BriefingResponse["ai"]) : null;
  } catch {
    return null;
  }
}

export function WelcomeBriefing({
  userId,
  userName,
  actions,
}: {
  userId: string;
  userName: string;
  /** Pulsanti a destra del saluto (come in PageHeader). */
  actions?: React.ReactNode;
}) {
  const [hour, setHour] = useState<number | null>(null);
  const [data, setData] = useState<BriefingResponse | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    const day = new Date().toISOString().slice(0, 10);
    const key = `dieffe-briefing:${userId}:${day}:${slotOf(h)}`;
    const cached = readCache(key);
    let alive = true;
    fetch(`/api/ai/briefing?hour=${h}${cached ? "&ai=0" : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BriefingResponse | null) => {
        if (!alive || !d) return;
        const ai = cached ?? d.ai;
        if (!cached && d.ai) {
          try {
            localStorage.setItem(key, JSON.stringify(d.ai));
          } catch {
            /* cache facoltativa */
          }
        }
        setData({ ...d, ai });
      })
      .catch(() => {});
    // L'ora si legge sul dispositivo: niente differenze tra server e browser.
    const t = setTimeout(() => alive && setHour(h), 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [userId]);

  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const pending = data?.pending ?? [];

  return (
    <section className="mb-5 md:mb-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="min-w-0 text-[26px] font-bold leading-tight tracking-tight">
          {hour === null ? "Ciao" : greeting(hour)}, {firstName}
        </h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <p className={cn("mt-1 min-h-5 max-w-3xl text-sm text-muted-foreground", !data && "animate-pulse")}>
        {data
          ? data.ai?.message ??
            (pending.length
              ? "Ecco cosa ti aspetta oggi: riprendi da dove eri rimasto."
              : "Tutto in ordine: è un buon momento per preparare nuovi preventivi.")
          : "Preparo il tuo riepilogo…"}
      </p>

      {data && (pending.length > 0 || (data.ai?.tips.length ?? 0) > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {pending.length > 0 && (
            <div className="surface p-0">
              <p className="px-4 pb-1 pt-3.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                In sospeso
              </p>
              <div className="divide-y">
                {pending.map((p) => {
                  const r = REASON[p.reason];
                  const Icon = r.icon;
                  return (
                    <Link
                      key={`${p.reason}-${p.id}`}
                      href={`/preventivi/${p.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors last:rounded-b-card hover:bg-accent/50"
                    >
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.cls)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.label(p.days)}
                          {p.clientName ? ` · ${p.clientName}` : ""}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {!!data.ai?.tips.length && (
            <div className="surface border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
                <Sparkles className="h-3.5 w-3.5" /> Consigli per te
              </p>
              <ul className="space-y-2">
                {data.ai.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 px-1 text-sm">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
