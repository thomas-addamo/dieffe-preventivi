"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getNotificationMeta } from "@/lib/notification-meta";
import { isDesktopApp, showDesktopNotification } from "@/lib/desktop-notifications";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * Mostra i toast "in-app" per le notifiche appena arrivate.
 *
 * IMPORTANTE: va montato UNA SOLA VOLTA nell'app (in AppShell), separato da
 * NotificationBell — che è invece reso due volte (header desktop + top bar
 * mobile). Tenere il toast qui evita il doppio toast.
 *
 * In più registra un listener sui messaggi del service worker: quando arriva
 * una push, il SW avvisa il client e qui invalidiamo la query così la
 * campanella e l'eventuale toast si aggiornano all'istante (realtime).
 */
export function NotificationToaster() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery<{
    notifications: NotificationItem[];
    unreadCount: number;
  }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=30");
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const handleClick = useCallback(
    (n: NotificationItem) => {
      if (!n.readAt) {
        fetch(`/api/notifications/${n.id}`, { method: "PATCH" })
          .then(() =>
            queryClient.invalidateQueries({ queryKey: ["notifications"] })
          )
          .catch(() => {});
      }
      if (n.link) router.push(n.link);
    },
    [router, queryClient]
  );

  // ── Realtime: il service worker ci avvisa quando arriva una push ────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "notification") {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [queryClient]);

  // ── Toast per le notifiche nuove non lette ──────────────────────────────────
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    const list = data?.notifications;
    if (!list) return;

    // Primo caricamento: registra le esistenti senza mostrare toast.
    if (!initializedRef.current) {
      list.forEach((n) => seenIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    const fresh = list.filter((n) => !seenIdsRef.current.has(n.id));
    fresh.forEach((n) => seenIdsRef.current.add(n.id));

    const toToast = fresh
      .filter((n) => !n.readAt)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .slice(-3);

    for (const n of toToast) {
      // App desktop (Electron): mostra anche la notifica nativa di sistema.
      if (isDesktopApp()) {
        showDesktopNotification(n.title, n.body, () => handleClick(n));
      }

      const meta = getNotificationMeta(n.type);
      const Icon = meta.icon;
      const isFeature = n.type === "feature";

      toast.custom(
        (id) => (
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              toast.dismiss(id);
              handleClick(n);
            }}
            className={cn(
              "group w-full max-w-[380px] flex items-start gap-3 rounded-2xl border p-3.5 text-left",
              "cursor-pointer bg-background/95 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
              "border-border/60 transition active:scale-[.98]",
              isFeature &&
                "bg-gradient-to-br from-violet-500/[0.12] to-fuchsia-500/[0.06] border-violet-500/40"
            )}
          >
            <span
              className={cn(
                "mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                meta.iconClass
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="flex-1 min-w-0">
              {isFeature && (
                <span className="inline-flex items-center gap-1 mb-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
                  ✨ Novità
                </span>
              )}
              <span className="block text-[15px] font-semibold leading-snug break-words">
                {n.title}
              </span>
              {n.body && (
                <span className="block text-[13px] text-muted-foreground mt-0.5 line-clamp-3 break-words">
                  {n.body}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.dismiss(id);
              }}
              className="-m-1 p-1 rounded-md text-muted-foreground/40 hover:text-foreground shrink-0 transition-colors"
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ),
        {
          position: "top-right",
          duration: isFeature ? 12_000 : 8_000,
        }
      );
    }
  }, [data, handleClick]);

  return null;
}
