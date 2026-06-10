"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  LayoutTemplate,
  Settings,
  UserCog,
  Building2,
  X,
  Trash2,
  Shield,
  BarChart2,
  Activity,
  ScrollText,
  List,
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
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/statistiche", label: "Statistiche", icon: BarChart2 },
  { href: "/admin/sessioni", label: "Sessioni attive", icon: Activity },
  { href: "/utenti", label: "Utenti", icon: UserCog },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

interface SidebarProps {
  userRole: string;
  onClose?: () => void;
  trashCount?: number;
}

export function Sidebar({ userRole, onClose, trashCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    cn(
      "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 min-h-[44px]",
      active
        ? "bg-primary/10 text-primary shadow-2xs"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  const activeIndicator = (
    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-primary" />
  );

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--sidebar-border)] shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-950 dark:to-blue-500 flex items-center justify-center shadow-xs">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 leading-tight">
          <span className="block font-semibold text-sm tracking-tight">
            Dieffe Preventivi
          </span>
          <span className="block text-[10px] text-muted-foreground uppercase tracking-widest">
            Ristrutturazioni
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Chiudi menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <div className="pb-1 px-3">
          <span className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
            Operatività
          </span>
        </div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={onClose} className={linkClass(active)}>
              {active && activeIndicator}
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Cestino — editor e admin */}
        {(userRole === "admin" || userRole === "editor") && (
          <Link
            href="/cestino"
            onClick={onClose}
            className={linkClass(pathname === "/cestino")}
          >
            {pathname === "/cestino" && activeIndicator}
            <Trash2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">Cestino</span>
            {trashCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {trashCount > 99 ? "99+" : trashCount}
              </span>
            )}
          </Link>
        )}

        {userRole === "admin" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3" /> Amministrazione
              </span>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href} onClick={onClose} className={linkClass(active)}>
                  {active && activeIndicator}
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
