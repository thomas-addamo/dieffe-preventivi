"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { BriefingResponse } from "@/app/api/ai/briefing/route";
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

  const today = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <section className="mb-5 md:mb-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" suppressHydrationWarning>
            {today}
          </p>
          <h1 className="mt-1 min-w-0 text-[26px] font-bold leading-tight tracking-tight md:text-[30px]">
            {hour === null ? "Ciao" : greeting(hour)}, {firstName}
          </h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* Un solo messaggio dell'IA, al posto dei riquadri (C1). */}
      <p className={cn("mt-1.5 flex min-h-5 max-w-3xl items-start gap-2 text-sm text-muted-foreground md:text-[15px]", !data && "animate-pulse")}>
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <span>
          {data
            ? data.ai?.message ??
              (pending.length
                ? "Ecco cosa ti aspetta oggi: riprendi da dove eri rimasto."
                : "Tutto in ordine: è un buon momento per preparare nuovi preventivi.")
            : "Preparo il tuo riepilogo…"}
        </span>
      </p>
    </section>
  );
}
