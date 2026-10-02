"use client";

import { ArrowUpRight, X } from "lucide-react";
import { getNotificationMeta } from "@/lib/notification-meta";
import { cn } from "@/lib/utils";

// Card della notifica in-app (toast in alto a destra) e della sua anteprima
// nel pannello admin: un solo componente, così le due restano identiche.
//
// Radius annidati, concentrici:
//   card 20px (rounded-2xl) − p-1 (4px)  → area interna 16px (rounded-xl)
//   area 16px              − p-2 (8px)  → icona e pulsante 8px (rounded-sm)

interface NotificationCardProps {
  type: string;
  title: string;
  body?: string | null;
  /** Mostra "Apri" quando la notifica porta a una pagina. */
  hasLink?: boolean;
  /** Testo temporale, es. "Adesso". */
  timeLabel?: string;
  onOpen?: () => void;
  onClose?: () => void;
  className?: string;
}

/** Solo le classi colore del testo dell'icona (riusate per l'etichetta). */
function textColorOf(iconClass: string) {
  return iconClass
    .split(" ")
    .filter((c) => c.startsWith("text-") || c.startsWith("dark:text-"))
    .join(" ");
}

export function NotificationCard({
  type,
  title,
  body,
  hasLink,
  timeLabel = "Adesso",
  onOpen,
  onClose,
  className,
}: NotificationCardProps) {
  const meta = getNotificationMeta(type);
  const Icon = meta.icon;
  const interactive = !!onOpen;

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border/70 bg-popover/95 p-1 text-popover-foreground",
        "shadow-[0_1px_2px_rgb(16_24_40/0.06),0_12px_32px_-4px_rgb(16_24_40/0.18)]",
        "backdrop-blur-xl dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_12px_32px_-4px_rgb(0_0_0/0.6)]",
        className
      )}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (interactive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onOpen?.();
          }
        }}
        className={cn(
          "group relative flex items-start gap-3 rounded-xl p-2 outline-none transition-colors",
          interactive && "cursor-pointer hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm",
            meta.iconClass
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0 flex-1 py-0.5 pr-6">
          <div className="flex items-center gap-1.5 text-[11px] font-medium leading-4">
            <span className={cn("truncate", textColorOf(meta.iconClass))}>{meta.label}</span>
            <span aria-hidden className="text-muted-foreground/50">·</span>
            <span className="shrink-0 text-muted-foreground">{timeLabel}</span>
          </div>
          <p className="mt-0.5 break-words text-sm font-semibold leading-snug">{title}</p>
          {body && (
            <p className="mt-0.5 line-clamp-3 break-words text-[13px] leading-snug text-muted-foreground">
              {body}
            </p>
          )}
          {hasLink && (
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-primary">
              Apri <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Chiudi notifica"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
