// ─────────────────────────────────────────────────────────────────────────────
// Metadati condivisi dei tipi di notifica: icona, etichetta, colori.
// Usato da NotificationBell (lista + toast) e dal form admin di invio.
// ─────────────────────────────────────────────────────────────────────────────

import {
  FileSignature,
  FileX2,
  RefreshCw,
  UserPlus,
  Lock,
  Unlock,
  Trash2,
  Info,
  Sparkles,
  Megaphone,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import type { Notification } from "@/lib/db/schema";

export type NotificationType = Notification["type"];

export interface NotificationMeta {
  /** Icona lucide. */
  icon: React.ElementType;
  /** Etichetta leggibile (italiano). */
  label: string;
  /** Classi per l'avatar nella lista campanella (bg + text). */
  iconClass: string;
  /** Colore "accent" usato per il bordo/sfondo del toast e dell'anteprima. */
  accentClass: string;
}

export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  // ── Eventi di dominio (generati dal sistema) ────────────────────────────────
  quote_signed: {
    icon: FileSignature,
    label: "Preventivo firmato",
    iconClass: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    accentClass: "border-emerald-500/30 bg-emerald-500/[0.04]",
  },
  quote_rejected: {
    icon: FileX2,
    label: "Preventivo rifiutato",
    iconClass: "bg-red-500/12 text-red-600 dark:text-red-400",
    accentClass: "border-red-500/30 bg-red-500/[0.04]",
  },
  quote_status: {
    icon: RefreshCw,
    label: "Stato preventivo",
    iconClass: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    accentClass: "border-blue-500/30 bg-blue-500/[0.04]",
  },
  quote_assigned: {
    icon: UserPlus,
    label: "Preventivo assegnato",
    iconClass: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    accentClass: "border-violet-500/30 bg-violet-500/[0.04]",
  },
  quote_locked: {
    icon: Lock,
    label: "Preventivo bloccato",
    iconClass: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    accentClass: "border-amber-500/30 bg-amber-500/[0.04]",
  },
  quote_unlocked: {
    icon: Unlock,
    label: "Preventivo sbloccato",
    iconClass: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    accentClass: "border-amber-500/30 bg-amber-500/[0.04]",
  },
  quote_deleted: {
    icon: Trash2,
    label: "Preventivo nel cestino",
    iconClass: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    accentClass: "border-zinc-500/30 bg-zinc-500/[0.04]",
  },
  system: {
    icon: Info,
    label: "Sistema",
    iconClass: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    accentClass: "border-zinc-500/30 bg-zinc-500/[0.04]",
  },
  // ── Notifiche create dall'admin (broadcast / comunicazioni) ─────────────────
  feature: {
    icon: Sparkles,
    label: "Nuova funzionalità",
    iconClass: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    accentClass: "border-violet-500/40 bg-violet-500/[0.06]",
  },
  announcement: {
    icon: Megaphone,
    label: "Comunicazione",
    iconClass: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    accentClass: "border-blue-500/30 bg-blue-500/[0.05]",
  },
  maintenance: {
    icon: Wrench,
    label: "Manutenzione",
    iconClass: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    accentClass: "border-amber-500/30 bg-amber-500/[0.05]",
  },
  alert: {
    icon: AlertTriangle,
    label: "Avviso importante",
    iconClass: "bg-red-500/12 text-red-600 dark:text-red-400",
    accentClass: "border-red-500/30 bg-red-500/[0.05]",
  },
};

/** Tipi che l'admin può creare manualmente dal pannello di invio. */
export const ADMIN_NOTIFICATION_TYPES = [
  "feature",
  "announcement",
  "maintenance",
  "alert",
] as const satisfies readonly NotificationType[];

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];

/** Descrizione mostrata nel selettore del form admin. */
export const ADMIN_TYPE_DESCRIPTION: Record<AdminNotificationType, string> = {
  feature: "Annuncia una nuova funzionalità con grafica dedicata.",
  announcement: "Comunicazione o avviso generale a tutto il team.",
  maintenance: "Avvisa di una manutenzione o di un'interruzione programmata.",
  alert: "Avviso urgente che richiede attenzione immediata.",
};

export function getNotificationMeta(type: string): NotificationMeta {
  return NOTIFICATION_META[type as NotificationType] ?? NOTIFICATION_META.system;
}
