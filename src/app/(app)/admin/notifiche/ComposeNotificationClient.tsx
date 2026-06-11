"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Users, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ADMIN_NOTIFICATION_TYPES,
  ADMIN_TYPE_DESCRIPTION,
  NOTIFICATION_META,
  type AdminNotificationType,
} from "@/lib/notification-meta";

interface Recipient {
  id: string;
  name: string;
  email: string;
}

const TITLE_MAX = 120;
const BODY_MAX = 500;

export function ComposeNotificationClient({
  recipients,
}: {
  recipients: Recipient[];
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<AdminNotificationType>("feature");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [target, setTarget] = useState("all");
  const [sending, setSending] = useState(false);

  const meta = NOTIFICATION_META[type];
  const PreviewIcon = meta.icon;
  const isFeature = type === "feature";

  async function send() {
    if (!title.trim()) {
      toast.error("Inserisci un titolo");
      return;
    }
    if (link.trim() && !link.trim().startsWith("/")) {
      toast.error("Il link deve essere un percorso interno (es. /dashboard)");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          body: body.trim() || null,
          link: link.trim() || null,
          target,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Errore durante l'invio");
        setSending(false);
        return;
      }
      const n = json.recipients as number;
      toast.success(
        target === "all"
          ? `Notifica inviata a ${n} utent${n === 1 ? "e" : "i"}`
          : "Notifica inviata"
      );
      // Aggiorna la campanella dell'admin (riceve la propria copia se "tutti").
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setTitle("");
      setBody("");
      setLink("");
    } catch {
      toast.error("Errore di rete durante l'invio");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto pb-20 lg:pb-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-lg md:text-xl font-semibold">Invia notifica</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Crea una notifica per tutto il team o per un singolo utente. Comparirà
          in alto a destra e nel centro notifiche.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Form */}
        <div className="space-y-5">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo di notifica</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {ADMIN_NOTIFICATION_TYPES.map((t) => {
                const m = NOTIFICATION_META[t];
                const Icon = m.icon;
                const active = t === type;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-primary ring-1 ring-primary bg-primary/[0.03]"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <span
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        m.iconClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{m.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                        {ADMIN_TYPE_DESCRIPTION[t]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Titolo */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">
              Titolo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="notif-title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isFeature
                  ? "Es: Nuovo import preventivi da file"
                  : "Es: Manutenzione programmata sabato"
              }
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {title.length}/{TITLE_MAX}
            </p>
          </div>

          {/* Testo */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-body">Testo</Label>
            <Textarea
              id="notif-body"
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Descrivi la novità o la comunicazione (opzionale)…"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {body.length}/{BODY_MAX}
            </p>
          </div>

          {/* Link */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-link">Link (opzionale)</Label>
            <Input
              id="notif-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/dashboard"
            />
            <p className="text-[11px] text-muted-foreground">
              Percorso interno all&apos;app. Cliccando la notifica l&apos;utente
              verrà portato qui.
            </p>
          </div>

          {/* Destinatario */}
          <div className="space-y-1.5">
            <Label>Destinatario</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" /> Tutti gli utenti
                  </span>
                </SelectItem>
                {recipients.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <UserIcon className="h-3.5 w-3.5" /> {r.name}
                      <span className="text-muted-foreground">— {r.email}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={send} disabled={sending} className="gap-2">
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Invia notifica
          </Button>
        </div>

        {/* Anteprima */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Anteprima</Label>
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3.5 shadow-sm",
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
              <PreviewIcon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              {isFeature && (
                <span className="inline-flex items-center gap-1 mb-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
                  ✨ Novità
                </span>
              )}
              <p className="text-sm font-semibold leading-snug break-words">
                {title.trim() || "Titolo della notifica"}
              </p>
              {(body.trim() || !title.trim()) && (
                <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-4">
                  {body.trim() || "Il testo della notifica apparirà qui."}
                </p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Comparirà come toast in alto a destra e resterà nel centro notifiche
            (campanella) di ogni destinatario.
          </p>
        </div>
      </div>
    </div>
  );
}
