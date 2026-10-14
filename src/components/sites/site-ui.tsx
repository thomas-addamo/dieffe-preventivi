"use client";

import { useSyncExternalStore } from "react";
import { CalendarClock, ClipboardCheck, Hammer, MapPinned, Package, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { HEALTH_COLORS, HEALTH_LABELS, type SiteHealth } from "@/lib/sites/metrics";

// Elementi grafici condivisi della Gestione Cantieri (dashboard, pagina del
// cantiere, pannello nella barra laterale).

export function HealthBadge({ health, className }: { health: SiteHealth; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", className)}
      style={{ background: `${HEALTH_COLORS[health]}1f`, color: HEALTH_COLORS[health] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH_COLORS[health] }} />
      {HEALTH_LABELS[health]}
    </span>
  );
}

/** Barra di avanzamento con eventuale tacca dell'avanzamento atteso oggi. */
export function ProgressBar({
  value,
  expected,
  health,
  className,
  thin,
}: {
  value: number;
  expected?: number | null;
  health?: SiteHealth;
  className?: string;
  thin?: boolean;
}) {
  const color = health ? HEALTH_COLORS[health] : "var(--primary)";
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full bg-foreground/[0.08]", thin ? "h-1" : "h-2", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
      {expected != null && expected > 0 && expected < 100 && (
        <span
          title={`Atteso oggi: ${Math.round(expected)}%`}
          className="absolute top-0 h-full w-0.5 bg-foreground/50"
          style={{ left: `${expected}%` }}
        />
      )}
    </div>
  );
}

export const EVENT_TYPES = {
  suolo_pubblico: { label: "Suolo pubblico", color: "#f59e0b", icon: MapPinned },
  intervento: { label: "Intervento ditta", color: "#3b82f6", icon: Hammer },
  consegna: { label: "Consegna materiali", color: "#10b981", icon: Package },
  sopralluogo: { label: "Sopralluogo", color: "#8b5cf6", icon: ClipboardCheck },
  scadenza: { label: "Scadenza", color: "#ef4444", icon: TriangleAlert },
  altro: { label: "Altro", color: "#64748b", icon: CalendarClock },
} as const;
export type EventType = keyof typeof EVENT_TYPES;

const noop = () => () => {};
/** true su Mac/iPhone/iPad (solo nel browser: sul server vale false). */
export function useAppleDevice() {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => false);
}

/** Indicazioni stradali: Mappe di Apple su Mac/iPhone, Google Maps altrove. */
export function directionsUrl(lat: number | null, lng: number | null, address: string | null, apple: boolean) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : (address ?? "");
  return apple
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function formatDays(n: number) {
  return n === 1 ? "1 giorno" : `${n} giorni`;
}

/** Nome leggibile del cantiere: i titoli dei preventivi sono spesso in maiuscolo. */
export function siteTitle(name: string) {
  const s = name.replace(/\s+/g, " ").trim();
  return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}
