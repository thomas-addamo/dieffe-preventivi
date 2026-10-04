"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  LayoutTemplate,
  Settings,
  UserCog,
  X,
  Trash2,
  Shield,
  BarChart2,
  Activity,
  ScrollText,
  List,
  BellRing,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ChevronLeft,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Barra laterale (desktop web + app desktop).
//
// Aperta e compressa hanno la STESSA struttura: cambia solo la larghezza.
// Le icone restano ferme nella stessa colonna, le etichette compaiono con un
// leggero ritardo dopo l'allargamento (e spariscono subito alla chiusura),
// logo e titoli di sezione occupano sempre lo stesso spazio: la transizione
// è fluida e senza salti. Da compressa i pulsanti sono quadrati.
//
// Misure (globals.css): --sb-w / --sb-w-collapsed = larghezze, --sb-pad =
// margine laterale, --sb-item = lato del pulsante quadrato, --sb-ipad =
// rientro che centra l'icona nel quadrato.
// ─────────────────────────────────────────────────────────────────────────────

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/preventivi", label: "Preventivi", icon: FileText },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/template", label: "Template", icon: LayoutTemplate },
  { href: "/listino", label: "Listino", icon: List },
  { href: "/statistiche", label: "Statistiche", icon: BarChart2 },
];

const adminItems = [
  { href: "/admin/notifiche", label: "Invia notifica", icon: BellRing },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/sessioni", label: "Sessioni attive", icon: Activity },
  { href: "/utenti", label: "Utenti", icon: UserCog },
];

interface SidebarProps {
  userRole: string;
  onClose?: () => void;
  trashCount?: number;
}

interface QuoteLite {
  id: string;
  code: string;
  title: string;
  status: string;
  clientName: string | null;
}

const STORAGE_KEY = "sidebar-collapsed";
/** Ritardo prima di richiudere la barra aperta al passaggio del mouse. */
const HOVER_CLOSE_DELAY = 220;

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

export function Sidebar({ userRole, onClose, trashCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pannello scorrevole "Preventivi" dentro la stessa barra.
  const [quotesPanel, setQuotesPanel] = useState(false);
  const [quotes, setQuotes] = useState<QuoteLite[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState("");

  // Stato persistito (solo desktop). onClose presente = drawer mobile → mai collassato.
  const isDrawer = !!onClose;
  useEffect(() => {
    if (isDrawer) return;
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, [isDrawer]);

  function toggleCollapsed() {
    setQuotesPanel(false);
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
    setHovered(false);
  }

  function onEnter() {
    if (isDrawer) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }

  function onLeave() {
    if (isDrawer) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHovered(false), HOVER_CLOSE_DELAY);
  }

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  // Espansa se: drawer mobile, oppure non compressa, oppure il mouse è sopra.
  const expanded = isDrawer || !collapsed || hovered;
  // Compressa ma aperta dal mouse: fluttua sopra il contenuto.
  const overlaying = !isDrawer && collapsed && hovered;

  // Il pannello preventivi esiste solo a barra aperta.
  const showQuotes = quotesPanel && expanded;

  async function loadQuotes() {
    setLoadingQuotes(true);
    try {
      const res = await fetch("/api/quotes");
      if (res.ok) setQuotes(await res.json());
    } catch {
      /* silenzioso: lista resta com'è */
    } finally {
      setLoadingQuotes(false);
    }
  }

  function openQuotesPanel() {
    setQuotesPanel(true);
    loadQuotes();
  }

  function openQuote(id: string) {
    router.push(`/preventivi/${id}`);
    onClose?.();
  }

  const activeQuoteId = pathname.startsWith("/preventivi/") ? pathname.split("/")[2] : null;

  const filteredQuotes = useMemo(() => {
    const q = quoteSearch.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        (it.clientName?.toLowerCase().includes(q) ?? false)
    );
  }, [quotes, quoteSearch]);

  // ── Stili condivisi ──────────────────────────────────────────────────────
  /** Elementi che compaiono solo da aperta: in sequenza dopo l'allargamento. */
  const reveal = cn(
    "transition-opacity",
    expanded ? "opacity-100 duration-200 delay-[120ms]" : "pointer-events-none opacity-0 duration-75"
  );

  const itemClass = (active: boolean) =>
    cn(
      "group relative flex w-full items-center gap-3 overflow-hidden whitespace-nowrap",
      "h-[var(--sb-item)] rounded-[var(--sb-item-radius)] pl-[var(--sb-ipad)] pr-2 text-sm font-medium",
      "transition-colors duration-150",
      // App desktop: tipografia e selezione da lista di sistema (Finder/Mail)
      "desktop:text-[13px]",
      active
        ? "bg-primary/10 text-primary desktop:bg-foreground/[0.08] desktop:text-foreground dark:desktop:bg-white/[0.1] desktop:[&>svg]:text-primary"
        : "text-muted-foreground hover:bg-accent hover:text-foreground desktop:text-foreground/80 desktop:hover:bg-foreground/[0.05] desktop:[&>svg]:text-primary/80"
    );

  const activeIndicator = (
    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary desktop:hidden" />
  );

  const renderLink = (
    href: string,
    label: string,
    Icon: typeof LayoutDashboard,
    active: boolean,
    badge?: number
  ) => (
    <Link
      key={href}
      href={href}
      onClick={onClose}
      title={!expanded ? label : undefined}
      aria-label={label}
      className={itemClass(active)}
    >
      {active && activeIndicator}
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn("flex-1 truncate", reveal)}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <>
          <span
            className={cn(
              "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white",
              reveal
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
          {/* Da compressa: puntino sul quadrato */}
          <span
            className={cn(
              "absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 transition-opacity",
              expanded ? "opacity-0 duration-75" : "opacity-100 duration-200 delay-150"
            )}
          />
        </>
      )}
    </Link>
  );

  /** Titolo di sezione: stessa altezza aperta/compressa (testo ↔ lineetta). */
  const sectionLabel = (text: string, icon?: React.ReactNode) => (
    <div className="relative flex h-8 items-end pb-1.5">
      <span
        className={cn(
          "flex items-center gap-1 whitespace-nowrap pl-[var(--sb-ipad)] text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80",
          "desktop:normal-case desktop:tracking-normal desktop:font-semibold desktop:text-muted-foreground/70",
          reveal
        )}
      >
        {icon}
        {text}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute bottom-3 left-[var(--sb-dash-left)] h-px w-5 bg-border transition-opacity",
          expanded ? "opacity-0 duration-75" : "opacity-100 duration-200 delay-150"
        )}
      />
    </div>
  );

  const preventiviActive = pathname === "/preventivi" || pathname.startsWith("/preventivi/");

  // ── Barra ────────────────────────────────────────────────────────────────
  const aside = (
    <aside
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={cn(
        "top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]",
        `transition-[width,box-shadow,background-color] duration-[320ms] ${EASE}`,
        expanded ? "w-[var(--sb-w)]" : "w-[var(--sb-w-collapsed)]",
        isDrawer ? "sticky" : "fixed left-0 z-30",
        // Aperta dal mouse: pannello flottante ben distinto dal contenuto
        overlaying &&
          "sidebar-overlay rounded-r-[var(--sb-overlay-radius)] border-border shadow-[0_0_0_0.5px_rgb(0_0_0/0.06),12px_0_40px_-8px_rgb(16_24_40/0.22)] dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.08),12px_0_40px_-8px_rgb(0_0_0/0.7)]"
      )}
    >
      {/* Riga superiore. Su Mac ospita i semafori della finestra; è trascinabile
          solo quando la barra NON è aperta dal mouse (una zona di trascinamento
          "ruba" il cursore e la barra si richiudeva prima di arrivare al pulsante). */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-[var(--sidebar-border)]",
          "pl-[var(--sb-logo-pad)] pr-[var(--sb-pad)]",
          "mac:h-[var(--desk-titlebar-h)] mac:pl-[84px]",
          !overlaying && "desktop-titlebar"
        )}
      >
        <Image
          src="/icona_dieffe.svg"
          alt="Dieffe"
          width={32}
          height={32}
          priority
          className="h-8 w-8 shrink-0 mac:hidden"
        />
        <span
          className={cn(
            "ml-3 flex-1 truncate whitespace-nowrap text-sm font-semibold tracking-tight mac:hidden",
            reveal
          )}
        >
          Dieffe Preventivi
        </span>
        <span className="hidden flex-1 mac:block" />
        {onClose ? (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Chiudi menu"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={toggleCollapsed}
            className={cn(
              // Annidato all'angolo in alto a destra della barra aperta col mouse
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sb-corner-radius)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              "mac:h-7 mac:w-7 mac:rounded-[var(--sb-inner-radius)] mac:hover:bg-foreground/[0.06]",
              reveal
            )}
            aria-label={collapsed ? "Mantieni aperta la barra laterale" : "Comprimi la barra laterale"}
            title={collapsed ? "Mantieni aperta" : "Comprimi"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Area centrale scorrevole: navigazione ↔ elenco preventivi */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className={`flex h-full transition-transform duration-300 ${EASE}`}
          style={{ width: "200%", transform: showQuotes ? "translateX(-50%)" : "translateX(0)" }}
        >
          {/* ── Pannello 1: navigazione ── */}
          <nav className="h-full w-1/2 overflow-y-auto overflow-x-hidden px-[var(--sb-pad)] pb-4 pt-3 mac:pt-0">
            {/* App Mac: marchio sotto i semafori. Sempre presente (il logo resta
                nella colonna delle icone): niente salti all'apertura. */}
            <div className="mb-1 hidden h-[var(--sb-item)] items-center gap-2.5 pl-[var(--sb-brand-pad)] mac:flex">
              <Image src="/icona_dieffe.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0 drop-shadow-sm" />
              <div className={cn("min-w-0 whitespace-nowrap leading-tight", reveal)}>
                <span className="block truncate text-[13px] font-semibold tracking-tight">Dieffe Preventivi</span>
                <span className="block truncate text-[11px] text-muted-foreground">Dieffe Ristrutturazioni</span>
              </div>
            </div>

            {sectionLabel("Operatività")}
            <div className="space-y-1">
              {navItems.map(({ href, label, icon: Icon }) =>
                href === "/preventivi" ? (
                  // Riga "Preventivi" con freccia che apre l'elenco (solo da aperta)
                  <div key={href} className="relative">
                    {renderLink(href, label, Icon, preventiviActive)}
                    <button
                      onClick={openQuotesPanel}
                      aria-label="Mostra elenco preventivi"
                      title="Elenco preventivi"
                      className={cn(
                        "absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--sb-inner-radius)] text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground",
                        reveal
                      )}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  renderLink(href, label, Icon, pathname === href || pathname.startsWith(href + "/"))
                )
              )}

              {(userRole === "admin" || userRole === "editor") &&
                renderLink("/cestino", "Cestino", Trash2, pathname === "/cestino", trashCount)}
            </div>

            {userRole === "admin" && (
              <>
                <div className="pt-3">{sectionLabel("Amministrazione", <Shield className="h-3 w-3" />)}</div>
                <div className="space-y-1">
                  {adminItems.map(({ href, label, icon: Icon }) =>
                    renderLink(href, label, Icon, pathname.startsWith(href))
                  )}
                </div>
              </>
            )}
          </nav>

          {/* ── Pannello 2: elenco preventivi ── */}
          <div className="flex h-full w-1/2 flex-col">
            <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-[var(--sidebar-border)] px-2 mac:h-9">
              <button
                onClick={() => setQuotesPanel(false)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Indietro"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="flex-1 truncate text-sm font-semibold">Preventivi</span>
              {!loadingQuotes && (
                <span className="pr-1 text-xs tabular-nums text-muted-foreground">
                  {filteredQuotes.length}
                </span>
              )}
            </div>

            <div className="shrink-0 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Cerca preventivo..."
                  className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 mac:h-7 mac:border-0 mac:bg-foreground/[0.06] mac:text-[13px]"
                />
              </div>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
              {loadingQuotes && quotes.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Caricamento...
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {quotes.length === 0 ? "Nessun preventivo" : "Nessun risultato"}
                </div>
              ) : (
                filteredQuotes.map((q) => {
                  const active = q.id === activeQuoteId;
                  return (
                    <button
                      key={q.id}
                      onClick={() => openQuote(q.id)}
                      title={q.title}
                      className={cn(
                        "w-full rounded-[var(--sb-item-radius)] px-2.5 py-2 text-left transition-colors desktop:py-1.5",
                        active ? "bg-primary/10 desktop:bg-foreground/[0.08]" : "hover:bg-accent desktop:hover:bg-foreground/[0.05]"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText
                          className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                        />
                        <span className={cn("truncate text-sm font-medium", active && "text-primary")}>
                          {q.title}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate pl-5 text-[11px] text-muted-foreground">
                        {q.clientName ?? "Nessun cliente"} · {q.code}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer — Impostazioni (TUTTI gli utenti) */}
      <div className="shrink-0 border-t border-[var(--sidebar-border)] px-[var(--sb-pad)] py-3">
        {renderLink("/impostazioni", "Impostazioni", Settings, pathname.startsWith("/impostazioni"))}
      </div>
    </aside>
  );

  if (isDrawer) return aside;

  return (
    <>
      {/* Segnaposto: riserva lo spazio della barra fissata (non di quella aperta dal mouse) */}
      <div
        className={cn(
          `h-screen shrink-0 transition-[width] duration-[320ms] ${EASE}`,
          collapsed ? "w-[var(--sb-w-collapsed)]" : "w-[var(--sb-w)]"
        )}
        aria-hidden
      />
      {aside}
    </>
  );
}
