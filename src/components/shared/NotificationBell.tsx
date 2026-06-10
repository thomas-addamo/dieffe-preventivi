"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  Bell,
  CheckCheck,
  FileSignature,
  FileX2,
  RefreshCw,
  UserPlus,
  Lock,
  Unlock,
  Trash2,
  Info,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type:
    | "quote_signed"
    | "quote_rejected"
    | "quote_status"
    | "quote_assigned"
    | "quote_locked"
    | "quote_unlocked"
    | "quote_deleted"
    | "system";
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_META: Record<
  NotificationItem["type"],
  { icon: React.ElementType; className: string }
> = {
  quote_signed: { icon: FileSignature, className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  quote_rejected: { icon: FileX2, className: "bg-red-500/12 text-red-600 dark:text-red-400" },
  quote_status: { icon: RefreshCw, className: "bg-blue-500/12 text-blue-600 dark:text-blue-400" },
  quote_assigned: { icon: UserPlus, className: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
  quote_locked: { icon: Lock, className: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  quote_unlocked: { icon: Unlock, className: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  quote_deleted: { icon: Trash2, className: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400" },
  system: { icon: Info, className: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400" },
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

  function handleClick(n: NotificationItem) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

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
                const meta = TYPE_META[n.type] ?? TYPE_META.system;
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
                          meta.className
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
