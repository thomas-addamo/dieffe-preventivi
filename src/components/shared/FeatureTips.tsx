"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Cartellini delle novità: un fumetto accanto al tasto nuovo che spiega cosa è
// cambiato. Uno alla volta, solo se il tasto è visibile in quella pagina,
// finché l'utente non lo chiude e comunque solo nei primi giorni dopo il
// rilascio (`until`). Chiuso una volta non torna più (memoria del browser).
//
// Per aggiungerne uno: mettere data-tip="<id>" sull'elemento e una voce in TIPS.
// ─────────────────────────────────────────────────────────────────────────────

type Tip = {
  id: string;
  text: string;
  /** Ultimo giorno in cui si mostra (compreso), AAAA-MM-GG. */
  until: string;
};

// 4.9.0 (fase C): 5 giorni dal rilascio del 22/11/2026.
const TIPS: Tip[] = [
  { id: "nav-preventivi", until: "2026-11-26", text: "Da adesso l'elenco completo dei preventivi lo trovi qui!" },
  { id: "dashboard-todo", until: "2026-11-26", text: "La dashboard ti mostra cosa fare adesso: tocca un riquadro per aprire l'elenco già filtrato." },
  { id: "search", until: "2026-11-26", text: "Nuovo: cerca preventivi, clienti e cantieri da qui, anche con ⌘K." },
  { id: "quote-client", until: "2026-11-26", text: "Il cliente ora si sceglie con la ricerca, e da qui puoi anche crearne uno nuovo." },
  // 4.14.0: pannello Sopralluogo, 5 giorni.
  { id: "sopralluogo", until: "2026-11-29", text: "Nuovo: annotazioni, foto e logistica del sopralluogo, anche sulla bozza." },
];

const STORE = "dieffe-tips-seen";

function readSeen(user: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`${STORE}:${user}`) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveSeen(user: string, ids: string[]) {
  try {
    localStorage.setItem(`${STORE}:${user}`, JSON.stringify(ids));
  } catch {
    /* senza memoria il cartellino si chiude solo per questa visita */
  }
}

/** Primo elemento visibile con quel data-tip (barra laterale o barra in basso). */
function findAnchor(id: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tip="${id}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}

type Placement = { tip: Tip; top: number; left: number; side: "right" | "below" | "above"; arrow: number };

const W = 280;

function place(tip: Tip, el: HTMLElement): Placement {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Barra laterale: a destra della voce. In basso allo schermo: sopra. Altrimenti sotto.
  if (r.right < vw * 0.3 && r.right + 12 + W < vw) {
    return { tip, side: "right", top: r.top + r.height / 2, left: r.right + 12, arrow: 0 };
  }
  const left = Math.max(12, Math.min(vw - W - 12, r.left + r.width / 2 - W / 2));
  const arrow = Math.max(16, Math.min(W - 16, r.left + r.width / 2 - left));
  if (r.bottom > vh * 0.7) return { tip, side: "above", top: r.top - 12, left, arrow };
  return { tip, side: "below", top: r.bottom + 12, left, arrow };
}

export function FeatureTips({ user }: { user: string }) {
  const pathname = usePathname();
  const [seen, setSeen] = useState<string[] | null>(null);
  const [pos, setPos] = useState<Placement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSeen(readSeen(user)), 0);
    return () => clearTimeout(t);
  }, [user]);

  // Cerca il primo cartellino da mostrare e lo tiene attaccato al suo tasto.
  useEffect(() => {
    if (!seen) return;
    const today = new Date().toISOString().slice(0, 10);
    const open = TIPS.filter((t) => t.until >= today && !seen.includes(t.id));
    if (!open.length) return;
    const tick = () => {
      for (const t of open) {
        const el = findAnchor(t.id);
        if (el) return setPos(place(t, el));
      }
      setPos(null);
    };
    const first = setTimeout(tick, 600); // dopo che la pagina si è sistemata
    const every = setInterval(tick, 400);
    window.addEventListener("resize", tick);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener("resize", tick);
    };
  }, [seen, pathname]);

  if (!pos || !seen) return null;

  function dismiss() {
    const next = [...(seen ?? []), pos!.tip.id];
    saveSeen(user, next);
    setSeen(next);
    setPos(null);
  }

  const { side } = pos;
  return (
    <div
      role="status"
      className={cn(
        "fixed z-[60] w-[280px] rounded-2xl bg-primary p-3.5 pr-9 text-[13px] leading-snug text-primary-foreground shadow-xl animate-in fade-in zoom-in-95",
        side === "right" && "-translate-y-1/2",
        side === "above" && "-translate-y-full"
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Freccia verso il tasto */}
      <span
        aria-hidden
        className={cn(
          "absolute h-3 w-3 rotate-45 bg-primary",
          side === "right" && "-left-1.5 top-1/2 -translate-y-1/2",
          side === "below" && "-top-1.5 -translate-x-1/2",
          side === "above" && "-bottom-1.5 -translate-x-1/2"
        )}
        style={side === "right" ? undefined : { left: pos.arrow }}
      />
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-80">
        <Sparkles className="h-3.5 w-3.5" /> Novità
      </p>
      <p>{pos.tip.text}</p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2.5 rounded-lg bg-primary-foreground/15 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-primary-foreground/25"
      >
        Ho capito
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Chiudi"
        className="absolute right-2 top-2 rounded-md p-1 opacity-80 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
