"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar({ userRole, onClose, trashCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

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
      {/* Pallino badge quando collassato */}
      {!expanded && badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500" />
      )}
    </Link>
  );

  const aside = (
    <aside
      onMouseEnter={() => !isDrawer && setHovered(true)}
      onMouseLeave={() => !isDrawer && setHovered(false)}
      className={cn(
        "flex flex-col shrink-0 border-r bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] h-screen top-0",
        "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        expanded ? "w-60" : "w-16",
        isDrawer
          ? "sticky"
          : "fixed left-0 z-30",
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
        {/* Chiudi (drawer mobile) */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Chiudi menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {/* Collassa/espandi (solo desktop) */}
        {!isDrawer && expanded && (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? "Espandi barra laterale" : "Riduci barra laterale"}
            title={collapsed ? "Espandi" : "Riduci"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-0.5">
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
          renderLink(
            href,
            label,
            Icon,
            pathname === href || pathname.startsWith(href + "/")
          )
        )}

        {/* Cestino — editor e admin */}
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

      {/* Footer — Impostazioni (TUTTI gli utenti) */}
      <div className="px-3 py-3 border-t border-[var(--sidebar-border)] shrink-0">
        {renderLink(
          "/impostazioni",
          "Impostazioni",
          Settings,
          pathname.startsWith("/impostazioni")
        )}
        {/* Tastino espandi quando è collassato (e non in hover) */}
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

  // Desktop: spaziatore che riserva la larghezza (la barra è fixed e fluttua su hover).
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
