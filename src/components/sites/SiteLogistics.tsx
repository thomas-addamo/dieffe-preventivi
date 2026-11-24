"use client";

import { Check, Truck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SITE_LOGISTICS, logisticsInfo } from "@/lib/sites/logistics";

// Logistica di cantiere (1–4): scelta con quattro schede da spuntare, nel
// pannello Sopralluogo del preventivo e nella pagina cantiere.

/** Colore del livello: dal verde (semplice) al rosso (serve il suolo pubblico). */
export const LOGISTICS_TONE: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-orange-500",
  4: "bg-red-500",
};

export function LogisticsDots({ level, className }: { level: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cn("h-2.5 w-1.5 rounded-full", i <= level ? LOGISTICS_TONE[level] : "bg-muted-foreground/20")} />
      ))}
    </span>
  );
}

export function LogisticsPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (level: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Logistica di cantiere" className="grid gap-2">
      {SITE_LOGISTICS.map((l) => {
        const on = value === l.level;
        return (
          <button
            key={l.level}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            // Un secondo tocco sulla scelta attuale la toglie.
            onClick={() => onChange(on ? null : l.level)}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
              on ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent/60"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
              )}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                {l.level}. {l.title}
                <LogisticsDots level={l.level} />
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{l.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Riga compatta per la pagina cantiere: mostra il livello e lo cambia in un popover. */
export function LogisticsStrip({
  value,
  onChange,
  canEdit,
}: {
  value: number | null;
  onChange: (level: number | null) => void;
  canEdit: boolean;
}) {
  const info = logisticsInfo(value);
  const body = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-xs text-muted-foreground">Logistica</span>
      {info ? (
        <>
          <LogisticsDots level={info.level} />
          <span className="text-sm font-medium">{info.title}</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">— {info.detail}</span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{canEdit ? "Da indicare dopo il sopralluogo" : "Non indicata"}</span>
      )}
    </span>
  );
  if (!canEdit) return <div className="surface !py-2.5">{body}</div>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="surface flex w-full items-center justify-between gap-2 !py-2.5 text-left transition-colors hover:border-primary/40">
          {body}
          <span className="shrink-0 text-xs font-medium text-primary">{info ? "Cambia" : "Indica"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96">
        <p className="mb-2 text-sm font-semibold">Logistica di cantiere</p>
        <LogisticsPicker value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
