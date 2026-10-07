"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichText } from "@/components/shared/RichText";
import { cn } from "@/lib/utils";

// Pulsante "Aiuto": l'assistente risponde su come si usa l'app, oppure si
// scrive all'amministratore (arriva come notifica).

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Come creo un lavoro extra?",
  "Come mando il preventivo al cliente da firmare?",
  "Come funziona il riordino del listino?",
  "Come preparo una lettera per i condòmini?",
];

const TOPICS = [
  { value: "problema", label: "Problema" },
  { value: "domanda", label: "Domanda" },
  { value: "funzione", label: "Nuova funzione" },
  { value: "altro", label: "Altro" },
] as const;

export function HelpDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Scheda aperta (controllata dal menu "Aiuto" dell'app desktop). */
  tab?: "ai" | "admin";
  onTabChange?: (t: "ai" | "admin") => void;
}) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["value"]>("domanda");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || asking) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setAsking(true);
    try {
      const res = await fetch("/api/ai/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        { role: "assistant", content: res.ok ? data.answer : data.error ?? "Assistente non disponibile" },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Assistente non raggiungibile: controlla la connessione." }]);
    } finally {
      setAsking(false);
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  async function sendToAdmin() {
    if (message.trim().length < 5) {
      toast.error("Scrivi qualche parola in più");
      return;
    }
    setSending(true);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, message, page: pathname }),
    });
    setSending(false);
    if (res.ok) {
      toast.success("Richiesta inviata all'amministratore");
      setMessage("");
      onOpenChange(false);
    } else {
      toast.error("Invio non riuscito, riprova");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aiuto</DialogTitle>
          <DialogDescription>Chiedi all&apos;assistente come fare, oppure scrivi all&apos;amministratore.</DialogDescription>
        </DialogHeader>

        <Tabs
          {...(tab ? { value: tab, onValueChange: (v: string) => onTabChange?.(v as "ai" | "admin") } : { defaultValue: "ai" })}
          className="min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai">Chiedi all&apos;assistente</TabsTrigger>
            <TabsTrigger value="admin">Scrivi all&apos;admin</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-3 space-y-3">
            <div className="max-h-[42dvh] min-h-40 space-y-2.5 overflow-y-auto rounded-lg border bg-muted/20 p-3">
              {messages.length === 0 ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-violet-500" /> Prova a chiedere:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        className="rounded-full border bg-card px-3 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card shadow-2xs"
                      )}
                    >
                      {m.role === "assistant" ? <RichText value={m.content} /> : m.content}
                    </div>
                  </div>
                ))
              )}
              {asking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> L&apos;assistente sta scrivendo…
                </div>
              )}
              <div ref={bottom} />
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Come faccio a…"
                className="flex h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base shadow-2xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 md:h-10 md:text-sm"
              />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0 md:h-10 md:w-10" disabled={!input.trim() || asking}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="admin" className="mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label>Argomento</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TOPICS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTopic(t.value)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                      topic === t.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="help-msg">Messaggio</Label>
              <Textarea
                id="help-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={1500}
                placeholder="Descrivi il problema o la richiesta…"
              />
              <p className="text-xs text-muted-foreground">
                L&apos;amministratore la riceve come notifica, con la pagina in cui ti trovi.
              </p>
            </div>
            <Button className="w-full gap-2" onClick={sendToAdmin} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Invia all&apos;amministratore
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
