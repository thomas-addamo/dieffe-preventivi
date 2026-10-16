"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPin, type CopyMode, type PinMode } from "@/lib/email/quote/text";

// Invio del preventivo al cliente per email (POST /api/quotes/[id]/email):
// testo già pronto e modificabile, PDF allegato, link di accesso, codice
// comunicato a voce oppure allegato, note controllate dall'IA, più
// destinatari in copia (CC) o copia nascosta (CCN).

type Contact = { id: string; name: string; email: string | null };
type Draft = {
  configured: boolean;
  from: { name: string; address: string };
  subject: string;
  message: string;
  to: { name: string; email: string }[];
  contacts: Contact[];
  status: string;
  closed: boolean;
  link: { active: boolean; url: string | null; expiresAt: string | null; days: number };
};
type Proofread = { corrected: string; changes: { from: string; to: string; reason?: string }[] };
export type EmailSentResult = {
  status: string;
  link: { token: string; expiresAt: string | null } | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RecipientField({
  label,
  values,
  onChange,
  contacts,
  autoFocus,
  trailing,
  exclude = [],
}: {
  label: string;
  values: string[];
  /** Indirizzi già presenti nell'altro campo: non vanno suggeriti. */
  exclude?: string[];
  onChange: (v: string[]) => void;
  contacts: Contact[];
  autoFocus?: boolean;
  trailing?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return contacts
      .filter((c) => c.email && !values.includes(c.email.toLowerCase()) && !exclude.includes(c.email.toLowerCase()))
      .filter((c) => c.name.toLowerCase().includes(q) || c.email!.toLowerCase().includes(q))
      .slice(0, 6);
  }, [contacts, text, values, exclude]);

  function add(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    const bad = parts.filter((p) => !EMAIL_RE.test(p));
    const good = parts.filter((p) => EMAIL_RE.test(p) && !values.includes(p));
    if (good.length) onChange([...values, ...good]);
    setText(bad.join(" "));
    if (bad.length) toast.error(`Indirizzo non valido: ${bad[0]}`);
  }

  const nameOf = (email: string) => contacts.find((c) => c.email?.toLowerCase() === email)?.name;

  return (
    <div className="relative">
      <div
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="w-12 shrink-0 pl-1 text-xs font-medium text-muted-foreground">{label}</span>
        {values.map((v) => (
          <span
            key={v}
            className="flex max-w-full items-center gap-1 rounded-md bg-muted py-0.5 pl-2 pr-1 text-xs"
            title={v}
          >
            <span className="truncate">{nameOf(v) ? `${nameOf(v)} · ${v}` : v}</span>
            <button
              type="button"
              aria-label={`Rimuovi ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="email"
          inputMode="email"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (text.trim()) add(text);
          }}
          onKeyDown={(e) => {
            if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && text.trim()) {
              if (e.key !== "Tab") e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={values.length ? "" : "nome o email…"}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {trailing}
      </div>
      {focused && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange([...values, c.email!.toLowerCase()]);
                setText("");
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent"
            >
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Va montato solo quando serve: ogni apertura parte da una bozza nuova. */
export function SendQuoteEmailDialog({
  quoteId,
  quoteCode,
  onClose,
  onSent,
}: {
  quoteId: string;
  quoteCode: string;
  onClose: () => void;
  onSent: (r: EmailSentResult) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [copies, setCopies] = useState<string[]>([]);
  const [showCopies, setShowCopies] = useState(false);
  const [copyMode, setCopyMode] = useState<CopyMode>("cc");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [pinMode, setPinMode] = useState<PinMode>("personal");
  const [newPin, setNewPin] = useState(false);
  const [linkDays, setLinkDays] = useState(30);

  const [checking, setChecking] = useState(false);
  const [proof, setProof] = useState<Proofread | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ recipients: number; pin: string | null } | null>(null);

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}/email`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error ?? "Impossibile preparare la mail");
        return data as Draft;
      })
      .then((d) => {
        setDraft(d);
        setTo(d.to.map((t) => t.email.toLowerCase()));
        setSubject(d.subject);
        setMessage(d.message);
        setLinkDays(d.link.days);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [quoteId]);

  const body = () => ({
    to,
    copies: showCopies ? copies : [],
    copyMode,
    subject,
    message,
    notes: notes.trim() || null,
    pinMode,
    newPin: pinMode === "personal" && newPin,
    linkDays,
  });

  async function checkNotes() {
    if (notes.trim().length < 2) return;
    setChecking(true);
    setProof(null);
    try {
      const res = await fetch("/api/ai/proofread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Controllo non riuscito");
      if (!data.changes?.length) toast.success("Nessun errore trovato");
      else setProof(data as Proofread);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Controllo non riuscito");
    } finally {
      setChecking(false);
    }
  }

  async function showPreview() {
    setPreviewing(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/email?preview=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body(), to: to.length ? to : ["anteprima@example.com"] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Anteprima non disponibile");
      setPreview(data.html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anteprima non disponibile");
    } finally {
      setPreviewing(false);
    }
  }

  async function send() {
    if (!to.length) {
      toast.error("Aggiungi almeno un destinatario");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Invio non riuscito");
      onSent({ status: data.status, link: data.link });
      if (data.pin) setDone({ recipients: data.recipients, pin: data.pin });
      else {
        toast.success(`Preventivo ${quoteCode} inviato a ${data.recipients} ${data.recipients === 1 ? "destinatario" : "destinatari"}`);
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invio non riuscito");
    } finally {
      setSending(false);
    }
  }

  const linkActive = !!draft?.link.active;
  const pinWarning =
    !draft?.closed && linkActive && (pinMode === "attach" || newPin)
      ? "Verrà generato un nuovo codice: quello attuale smetterà di funzionare."
      : null;

  const pinOption = (value: PinMode, icon: React.ReactNode, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setPinMode(value)}
      aria-pressed={pinMode === value}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        pinMode === value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          pinMode === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> {preview ? "Anteprima della mail" : `Invia ${quoteCode} per email`}
          </DialogTitle>
          <DialogDescription className="truncate">
            {draft ? `Da: ${draft.from.name} <${draft.from.address}> · PDF allegato` : "Preparazione della mail…"}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 overflow-y-auto px-5 py-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" />
              <div>
                <p className="font-medium">Mail inviata</p>
                <p className="text-sm text-muted-foreground">
                  {done.recipients} {done.recipients === 1 ? "destinatario" : "destinatari"} · la trovi anche in “Inviati” su Gmail
                </p>
              </div>
            </div>
            {done.pin && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Codice di accesso da comunicare al cliente
                </p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-center font-mono text-2xl font-bold tracking-widest text-amber-900 dark:border-amber-500/30 dark:bg-background dark:text-amber-100">
                    {formatPin(done.pin)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(done.pin!);
                      toast.success("Codice copiato");
                    }}
                  >
                    <Copy /> Copia
                  </Button>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Per sicurezza viene mostrato solo ora: annotalo prima di chiudere.
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={onClose}>Fatto</Button>
            </div>
          </div>
        ) : loadError ? (
          <p className="px-5 py-10 text-center text-sm text-destructive">{loadError}</p>
        ) : !draft ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : preview ? (
          <div className="min-h-0 flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
            <iframe
              title="Anteprima mail"
              srcDoc={preview}
              sandbox=""
              className="h-[65dvh] w-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {!draft.configured && (
              <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  L&apos;invio non è ancora attivo: manca la password per le app di Gmail. Puoi preparare la mail e vedere
                  l&apos;anteprima.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <RecipientField
                label="A"
                values={to}
                onChange={setTo}
                exclude={copies}
                contacts={draft.contacts}
                autoFocus={!to.length}
                trailing={
                  !showCopies && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCopies(true);
                      }}
                      className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Cc/Ccn
                    </button>
                  )
                }
              />
              {showCopies && (
                <RecipientField
                  label={copyMode === "cc" ? "Cc" : "Ccn"}
                  values={copies}
                  onChange={setCopies}
                  exclude={to}
                  contacts={draft.contacts}
                  autoFocus
                  trailing={
                    <span className="flex shrink-0 rounded-md bg-muted p-0.5 text-xs" onClick={(e) => e.stopPropagation()}>
                      {(["cc", "bcc"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCopyMode(m)}
                          title={m === "cc" ? "Copia: tutti vedono i destinatari" : "Copia nascosta: ognuno vede solo sé stesso"}
                          className={cn(
                            "rounded px-2 py-0.5 font-medium",
                            copyMode === m ? "bg-background shadow-sm" : "text-muted-foreground"
                          )}
                        >
                          {m === "cc" ? "CC" : "CCN"}
                        </button>
                      ))}
                    </span>
                  }
                />
              )}
              {!draft.to.length && (
                <p className="text-xs text-muted-foreground">Il cliente non ha un&apos;email in anagrafica: inseriscila qui.</p>
              )}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Oggetto</span>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={250} />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Messaggio</span>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={5000} />
              <span className="block text-xs text-muted-foreground">
                Seguono in automatico: riepilogo del preventivo, link per aprirlo online, codice di accesso, le tue note e la firma.
              </span>
            </label>

            {draft.closed ? (
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Il preventivo è già {draft.status === "accepted" ? "accettato" : "rifiutato"}: verrà inviato solo il PDF, senza link.
              </p>
            ) : (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Codice di accesso al link</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pinOption("personal", <ShieldCheck className="h-4 w-4" />, "Lo comunico io", "Nella mail: “le verrà comunicato personalmente”")}
                  {pinOption("attach", <KeyRound className="h-4 w-4" />, "Allegalo alla mail", "Il codice è scritto nella mail")}
                </div>
                {linkActive ? (
                  pinMode === "personal" && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={newPin} onCheckedChange={(v) => setNewPin(v === true)} />
                      Genera un nuovo codice da comunicare (se hai perso quello attuale)
                    </label>
                  )
                ) : (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    Verrà creato il link di accesso, valido
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={linkDays}
                      onChange={(e) => setLinkDays(Math.min(365, Math.max(1, Number(e.target.value) || 30)))}
                      className="w-14 rounded-md border bg-card px-1.5 py-0.5 text-center text-foreground"
                    />
                    giorni{pinMode === "personal" ? ", e ti mostrerò il codice da comunicare." : "."}
                  </p>
                )}
                {pinWarning && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {pinWarning}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-end justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Note aggiuntive (facoltative)</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  disabled={checking || notes.trim().length < 2}
                  onClick={checkNotes}
                >
                  {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Controlla con IA
                </Button>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setProof(null);
                }}
                rows={3}
                maxLength={5000}
                placeholder="Es. tempi di inizio lavori, materiali da scegliere, disponibilità per un sopralluogo…"
              />
              {proof && (
                <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs font-medium">
                    {proof.changes.length} {proof.changes.length === 1 ? "correzione suggerita" : "correzioni suggerite"}
                  </p>
                  <ul className="space-y-1 text-sm">
                    {proof.changes.map((c, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-destructive line-through decoration-destructive/60">{c.from}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">{c.to}</span>
                        {c.reason && <span className="text-xs text-muted-foreground">({c.reason})</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setNotes(proof.corrected);
                        setProof(null);
                        toast.success("Correzioni applicate");
                      }}
                    >
                      <Check /> Applica
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setProof(null)}>
                      Ignora
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {draft && !done && (
          <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
            {preview ? (
              <Button variant="ghost" onClick={() => setPreview(null)}>
                <ArrowLeft /> Modifica
              </Button>
            ) : (
              <Button variant="outline" onClick={showPreview} disabled={previewing || !subject.trim() || !message.trim()}>
                {previewing ? <Loader2 className="animate-spin" /> : <Eye />} Anteprima
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={sending} className="hidden sm:inline-flex">
                Annulla
              </Button>
              <Button
                onClick={send}
                disabled={sending || !draft.configured || !to.length || !subject.trim() || !message.trim()}
              >
                {sending ? <Loader2 className="animate-spin" /> : <Send />} Invia
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
