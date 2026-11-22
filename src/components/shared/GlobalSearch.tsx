"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, HardHat, Loader2, Plus, Search, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { SearchResult } from "@/app/api/search/route";
import { usePermissions } from "@/hooks/use-permissions";
import { QUOTE_STATUS_LABELS, cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Ricerca globale (C2): campo al centro della barra in alto e finestra ⌘K con
// preventivi, clienti, cantieri e azioni rapide. Frecce per muoversi, Invio
// per aprire, Esc per chiudere. Si apre anche dal menu dell'app Mac
// (?ricerca=1, vedi MenuActions) e con openGlobalSearch().
// ─────────────────────────────────────────────────────────────────────────────

const OPEN_EVENT = "dieffe:global-search";

/** Apre la finestra di ricerca da qualsiasi punto dell'app. */
export function openGlobalSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Entry = { key: string; group: string; label: string; detail?: string; href: string; icon: React.ElementType };

const EMPTY: SearchResult = { quotes: [], clients: [], sites: [] };

export function GlobalSearchField() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={openGlobalSearch}
        data-tip="search"
        className="flex h-9 w-full max-w-[520px] items-center gap-2.5 rounded-[10px] border bg-muted/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Cerca preventivi, clienti, cantieri…</span>
        <kbd className="hidden shrink-0 rounded-md border bg-background px-1.5 py-0.5 font-sans text-[11px] font-semibold text-foreground/80 sm:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      <GlobalSearchDialog />
    </>
  );
}

function GlobalSearchDialog() {
  const router = useRouter();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K ovunque (nell'app Mac lo intercetta il menu, che apre lo stesso).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Cerca dopo una breve pausa nella digitazione; le risposte vecchie si scartano.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((d: SearchResult) => {
          setResult(d);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const short = query.trim().length < 2;
  const entries = useMemo<Entry[]>(() => {
    const r = short ? EMPTY : result;
    const q = query.trim().toLowerCase();
    const all: (Entry | false)[] = [
      can.createQuote && { key: "a-q", group: "Azioni", label: "Nuovo preventivo", href: "/preventivi?nuovo=1", icon: Plus },
      can.createQuote && { key: "a-i", group: "Azioni", label: "Importa preventivo da file", href: "/preventivi?importa=1", icon: Plus },
      can.manageClients && { key: "a-c", group: "Azioni", label: "Nuovo cliente", href: "/clienti?nuovo=1", icon: Plus },
    ];
    const actions = all.filter((a): a is Entry => !!a && (!q || a.label.toLowerCase().includes(q)));
    return [
      ...r.quotes.map((x) => ({
        key: `q-${x.id}`, group: "Preventivi", label: x.title, icon: FileText, href: `/preventivi/${x.id}`,
        detail: [x.code, x.clientName, QUOTE_STATUS_LABELS[x.status]].filter(Boolean).join(" · "),
      })),
      ...r.clients.map((x) => ({
        key: `c-${x.id}`, group: "Clienti", label: x.name, icon: User, href: `/clienti?apri=${x.id}`, detail: x.address ?? undefined,
      })),
      ...r.sites.map((x) => ({
        key: `s-${x.id}`, group: "Cantieri", label: x.name, icon: HardHat, href: `/cantieri/${x.id}`,
        detail: [x.address, x.archived ? "archiviato" : null].filter(Boolean).join(" · ") || undefined,
      })),
      ...actions,
    ];
  }, [result, short, query, can.createQuote, can.manageClients]);

  function go(e: Entry | undefined) {
    if (!e) return;
    setOpen(false);
    router.push(e.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = entries.length;
      if (!n) return;
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[active]);
    }
  }

  const nothing = !short && !loading && entries.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQuery("");
          setResult(EMPTY);
          setActive(0);
        }
      }}
    >
      <DialogContent className="top-[12vh] max-w-[620px] translate-y-0 gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Cerca</DialogTitle>
        <DialogDescription className="sr-only">Cerca preventivi, clienti e cantieri</DialogDescription>
        <div className="flex h-[52px] items-center gap-2.5 border-b px-4">
          {loading ? <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-muted-foreground" /> : <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cerca preventivi, clienti, cantieri…"
            aria-label="Cerca"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Esc per chiudere</span>
        </div>
        <div ref={listRef} className="max-h-[min(60vh,440px)] overflow-y-auto py-1.5">
          {short && entries.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Scrivi almeno due lettere: codice, titolo, cliente o indirizzo.</p>
          )}
          {nothing && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nessun risultato per «{query.trim()}».</p>}
          {entries.map((e, i) => (
            <div key={e.key}>
              {(i === 0 || entries[i - 1].group !== e.group) && (
                <p className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{e.group}</p>
              )}
              <button
                type="button"
                data-index={i}
                onMouseMove={() => active !== i && setActive(i)}
                onClick={() => go(e)}
                className={cn("flex w-full items-center gap-3 px-4 py-2 text-left", i === active && "bg-primary/10")}
              >
                <e.icon className={cn("h-4 w-4 shrink-0", i === active ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.label}</span>
                  {e.detail && <span className="block truncate text-xs text-muted-foreground">{e.detail}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
