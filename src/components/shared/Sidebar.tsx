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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/preventivi", label: "Preventivi", icon: FileText },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/template", label: "Template", icon: LayoutTemplate },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

const adminItems = [
  { href: "/utenti", label: "Utenti", icon: UserCog },
];

interface SidebarProps {
  userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[var(--sidebar-border)]">
        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm tracking-tight">
          Dieffe Preventivi
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {userRole === "admin" && (
          <>
            <div className="pt-3 pb-1 px-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Amministrazione
              </span>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
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
