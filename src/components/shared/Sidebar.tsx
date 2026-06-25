"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/preventivi", label: "Preventivi", icon: FileText },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/template", label: "Template", icon: LayoutTemplate },
  { href: "/listino", label: "Listino", icon: List },
];

const adminItems = [
  { href: "/admin/notifiche", label: "Invia notifica", icon: BellRing },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/statistiche", label: "Statistiche", icon: BarChart2 },
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

export function Sidebar({ userRole, onClose, trashCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

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
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Espanso se: drawer mobile, oppure non collassato, oppure il mouse è sopra.
  const expanded = isDrawer || !collapsed || hovered;
  // Quando è collassato ma espanso per hover, la barra fluttua sopra il contenuto.
  const overlaying = !isDrawer && collapsed && hovered;

  // Se la barra si stringe a icone, chiudi il pannello preventivi.
  useEffect(() => {
    if (!expanded) setQuotesPanel(false);
  }, [expanded]);

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

  const linkClass = (active: boolean) =>
    cn(
      "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 min-h-[44px]",
      !expanded && "justify-center px-0",
      active
        ? "bg-primary/10 text-primary shadow-2xs"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  const labelClass = cn(
    "truncate transition-[opacity] duration-200",
    expanded ? "opacity-100" : "opacity-0"
  );

  const activeIndicator = (
    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-primary" />
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
      className={linkClass(active)}
    >
      {active && activeIndicator}
      <Icon className="w-4 h-4 shrink-0" />
      {expanded && <span className={cn(labelClass, "flex-1")}>{label}</span>}
      {expanded && badge !== undefined && badge > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {!expanded && badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500" />
      )}
    </Link>
  );

  const preventiviActive = pathname === "/preventivi" || pathname.startsWith("/preventivi/");

  // Riga "Preventivi" con freccia che apre il pannello-elenco (solo da espansa).
  const preventiviRow = expanded ? (
    <div
      className={cn(
        "group relative flex items-center rounded-lg transition-all duration-150 min-h-[44px]",
        preventiviActive
          ? "bg-primary/10 text-primary shadow-2xs"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {preventiviActive && activeIndicator}
      <Link
        href="/preventivi"
        onClick={onClose}
        className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5 text-sm font-medium"
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate">Preventivi</span>
      </Link>
      <button
        onClick={openQuotesPanel}
        aria-label="Mostra elenco preventivi"
        title="Elenco preventivi"
        className="flex items-center self-stretch rounded-r-lg px-2 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  ) : (
    renderLink("/preventivi", "Preventivi", FileText, preventiviActive)
  );

  const aside = (
    <aside
      onMouseEnter={() => !isDrawer && setHovered(true)}
      onMouseLeave={() => !isDrawer && setHovered(false)}
      className={cn(
        "flex flex-col shrink-0 border-r bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] h-screen top-0",
        "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        expanded ? "w-60" : "w-16",
        isDrawer ? "sticky" : "fixed left-0 z-30",
        overlaying && "shadow-2xl"
      )}
    >
      {/* Logo + toggle */}
      <div
        className={cn(
          "flex items-center gap-3 h-14 border-b border-[var(--sidebar-border)] shrink-0",
          expanded ? "px-4" : "px-0 justify-center"
        )}
      >
        <Image
          src="/icona_dieffe.svg"
          alt="Dieffe"
          width={32}
          height={32}
          priority
          className="h-8 w-8 shrink-0"
        />
        {expanded && (
          <div className="flex-1 leading-tight overflow-hidden">
            <span className="block font-semibold text-sm tracking-tight truncate">
              Dieffe Preventivi
            </span>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Chiudi menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {!isDrawer && expanded && (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? "Espandi barra laterale" : "Riduci barra laterale"}
            title={collapsed ? "Espandi" : "Riduci"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Area centrale scorrevole: pannello principale ↔ elenco preventivi */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ width: "200%", transform: quotesPanel ? "translateX(-50%)" : "translateX(0)" }}
        >
          {/* ── Pannello 1: navigazione ── */}
          <nav className="w-1/2 h-full overflow-y-auto overflow-x-hidden py-4 px-3 space-y-0.5">
            {expanded ? (
              <div className="pb-1 px-3">
                <span className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                  Operatività
                </span>
              </div>
            ) : (
              <div className="h-2" />
            )}

            {navItems.map(({ href, label, icon: Icon }) =>
              href === "/preventivi" ? (
                <div key={href}>{preventiviRow}</div>
              ) : (
                renderLink(href, label, Icon, pathname === href || pathname.startsWith(href + "/"))
              )
            )}

            {(userRole === "admin" || userRole === "editor") &&
              renderLink("/cestino", "Cestino", Trash2, pathname === "/cestino", trashCount)}

            {userRole === "admin" && (
              <>
                {expanded ? (
                  <div className="pt-4 pb-1 px-3">
                    <span className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Amministrazione
                    </span>
                  </div>
                ) : (
                  <div className="my-2 mx-2 border-t border-[var(--sidebar-border)]" />
                )}
                {adminItems.map(({ href, label, icon: Icon }) =>
                  renderLink(href, label, Icon, pathname.startsWith(href))
                )}
              </>
            )}
          </nav>

          {/* ── Pannello 2: elenco preventivi ── */}
          <div className="w-1/2 h-full flex flex-col">
            <div className="flex items-center gap-1.5 px-2 h-11 border-b border-[var(--sidebar-border)] shrink-0">
              <button
                onClick={() => setQuotesPanel(false)}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Indietro"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="flex-1 text-sm font-semibold truncate">Preventivi</span>
              {!loadingQuotes && (
                <span className="text-xs text-muted-foreground tabular-nums pr-1">
                  {filteredQuotes.length}
                </span>
              )}
            </div>

            <div className="px-3 py-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Cerca preventivo..."
                  className="w-full h-8 pl-8 pr-2 rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {loadingQuotes && quotes.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Caricamento...
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
                        "w-full text-left rounded-lg px-2.5 py-2 transition-colors",
                        active ? "bg-primary/10" : "hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            active ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm font-medium truncate",
                            active && "text-primary"
                          )}
                        >
                          {q.title}
                        </span>
                      </div>
                      <div className="mt-0.5 pl-5 truncate text-[11px] text-muted-foreground">
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
      <div className="px-3 py-3 border-t border-[var(--sidebar-border)] shrink-0">
        {renderLink("/impostazioni", "Impostazioni", Settings, pathname.startsWith("/impostazioni"))}
        {!isDrawer && collapsed && (
          <button
            onClick={toggleCollapsed}
            className="mt-1 w-full flex justify-center p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Espandi barra laterale"
            title="Espandi"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );

  if (isDrawer) return aside;

  return (
    <>
      <div
        className={cn(
          "h-screen shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          collapsed ? "w-16" : "w-60"
        )}
        aria-hidden
      />
      {aside}
    </>
  );
}
