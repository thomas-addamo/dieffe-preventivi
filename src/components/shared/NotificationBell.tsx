"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Bell, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNotificationMeta } from "@/lib/notification-meta";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{
    notifications: NotificationItem[];
    unreadCount: number;
  }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=30");
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const markAllRead = useMutation({
    mutationFn: () => fetch("/api/notifications", { method: "PATCH" }),
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}`, { method: "PATCH" }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.notifications ?? [];

  const handleClick = useCallback(
    (n: NotificationItem) => {
      if (!n.readAt) markRead.mutate(n.id);
      if (n.link) {
        setOpen(false);
        router.push(n.link);
      }
    },
    [markRead, router]
  );

  // ── Toast in alto a destra per le notifiche appena arrivate ─────────────────
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    const list = data?.notifications;
    if (!list) return;

    // Primo caricamento: registra le notifiche esistenti senza mostrare toast.
    if (!initializedRef.current) {
      list.forEach((n) => seenIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    const fresh = list.filter((n) => !seenIdsRef.current.has(n.id));
    fresh.forEach((n) => seenIdsRef.current.add(n.id));

    // Mostra un toast solo per le nuove non lette (max 3, dalla più vecchia).
    const toToast = fresh
      .filter((n) => !n.readAt)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .slice(-3);

    for (const n of toToast) {
      const meta = getNotificationMeta(n.type);
      const Icon = meta.icon;
      const isFeature = n.type === "feature";

      toast.custom(
        (id) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              handleClick(n);
            }}
            className={cn(
              "w-full max-w-[380px] flex items-start gap-3 rounded-xl border p-3.5 text-left shadow-lg backdrop-blur",
              "bg-background/95",
              meta.accentClass,
              isFeature &&
                "bg-gradient-to-br from-violet-500/[0.10] to-fuchsia-500/[0.06] border-violet-500/40"
            )}
          >
            <span
              className={cn(
                "mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                meta.iconClass
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1 min-w-0">
              {isFeature && (
                <span className="inline-flex items-center gap-1 mb-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
                  ✨ Novità
                </span>
              )}
              <span className="block text-sm font-semibold leading-snug">
                {n.title}
              </span>
              {n.body && (
                <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-3">
                  {n.body}
                </span>
              )}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                toast.dismiss(id);
              }}
              className="p-1 -m-1 rounded-md text-muted-foreground/50 hover:text-foreground shrink-0"
              aria-label="Chiudi"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          </button>
        ),
        {
          position: "top-right",
          duration: isFeature ? 12_000 : 8_000,
        }
      );
    }
  }, [data, handleClick]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] max-w-[calc(100vw-24px)] p-0 overflow-hidden"
      >
        {/* Header del pannello */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifiche</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {unreadCount} nuove
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Segna tutte lette
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Caricamento…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nessuna notifica</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ti avviseremo qui quando succede qualcosa.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const meta = getNotificationMeta(n.type);
                const Icon = meta.icon;
                const unread = !n.readAt;
                return (
                  <li key={n.id} className="group relative">
                    <button
                      onClick={() => handleClick(n)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60",
                        unread && "bg-primary/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                          meta.iconClass
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={cn(
                            "block text-sm leading-snug",
                            unread ? "font-semibold" : "font-medium text-foreground/80"
                          )}
                        >
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.body}
                          </span>
                        )}
                        <span className="block text-[11px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                            locale: it,
                          })}
                        </span>
                      </span>
                      {unread && (
                        <span className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate(n.id);
                      }}
                      aria-label="Elimina notifica"
                      className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
