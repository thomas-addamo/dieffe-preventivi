"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NotificationCard } from "@/components/shared/NotificationCard";
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

      toast.custom(
        (id) => (
          <NotificationCard
            type={n.type}
            title={n.title}
            body={n.body}
            hasLink={!!n.link}
            onOpen={() => {
              toast.dismiss(id);
              handleClick(n);
            }}
            onClose={() => toast.dismiss(id)}
          />
        ),
        {
          position: "top-right",
          duration: n.type === "feature" ? 12_000 : 8_000,
          // Nessuno stile del toast di base: la card ha già bordo, raggio e ombra
          // (prima appariva un rettangolo attorno alla card arrotondata).
          unstyled: true,
          className: "!bg-transparent !border-0 !shadow-none !p-0",
        }
      );
    }
  }, [data, handleClick]);

  return null;
}
