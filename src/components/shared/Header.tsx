"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Monitor, LogOut, User, ChevronDown, ChevronRight, Menu } from "lucide-react";
import { GlobalSearchField } from "@/components/shared/GlobalSearch";
import { usePageCrumbStore } from "@/lib/stores/page-crumb";
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS, cn } from "@/lib/utils";
import { useTheme } from "@/components/shared/ThemeProvider";
import { NotificationBell } from "@/components/shared/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface HeaderProps {
  userName: string;
  userEmail: string;
  title?: string;
  onMenuClick?: () => void;
}

// Barra in alto (C2): a sinistra il percorso della pagina, al centro la
// ricerca globale (⌘K), a destra notifiche, tema e menu utente.

const SECTIONS: Record<string, { label: string; href: string }> = {
  dashboard: { label: "Dashboard", href: "/dashboard" },
  preventivi: { label: "Preventivi", href: "/preventivi" },
  clienti: { label: "Clienti", href: "/clienti" },
  "lavori-extra": { label: "Lavori extra", href: "/lavori-extra" },
  cantieri: { label: "Gestione Cantieri", href: "/cantieri" },
  comunicazioni: { label: "Comunicazioni", href: "/comunicazioni" },
  listino: { label: "Listino", href: "/listino" },
  statistiche: { label: "Statistiche", href: "/statistiche" },
  cestino: { label: "Cestino", href: "/cestino" },
  profilo: { label: "Profilo", href: "/profilo" },
  impostazioni: { label: "Impostazioni", href: "/impostazioni" },
  utenti: { label: "Utenti", href: "/utenti" },
  altro: { label: "Altro", href: "/altro" },
  admin: { label: "Amministrazione", href: "/admin/notifiche" },
};
const ADMIN_PAGES: Record<string, string> = { notifiche: "Invia notifica", "audit-log": "Audit log", sessioni: "Sessioni attive" };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "U";
}

function Breadcrumb() {
  const pathname = usePathname();
  const crumb = usePageCrumbStore((s) => s.crumb);
  const [first, second] = pathname.split("/").filter(Boolean);
  const section = first ? SECTIONS[first] : undefined;
  const parts: { label: string; href?: string; status?: string }[] = [];
  if (section) parts.push({ label: section.label, href: section.href });
  if (first === "admin" && second) parts.push({ label: ADMIN_PAGES[second] ?? second });
  else if (first === "preventivi" && second === "nuovo") parts.push({ label: "Nuovo" });
  else if (second && crumb) parts.push({ label: crumb.label, status: crumb.status });
  if (!parts.length) return <span className="text-sm font-medium">Dieffe</span>;
  return (
    <nav aria-label="Percorso" className="flex min-w-0 items-center gap-1.5 text-sm mac:text-[13px]">
      {parts.map((p, i) => {
        const last = i === parts.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
            {last || !p.href ? (
              <span className={cn("truncate font-semibold", p.status && "font-mono text-[13px]")}>{p.label}</span>
            ) : (
              <Link href={p.href} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                {p.label}
              </Link>
            )}
            {p.status && (
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", QUOTE_STATUS_COLORS[p.status])}>
                {QUOTE_STATUS_LABELS[p.status] ?? p.status}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export function Header({ userName, userEmail, title, onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    toast.success("Disconnesso");
  }

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="desktop-titlebar flex items-center justify-between gap-3 h-14 px-4 md:px-6 border-b bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 mac:h-[var(--desk-titlebar-h)] mac:px-5 mac:bg-transparent mac:backdrop-blur-none mac:border-border/60">
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-3">
        {/* Hamburger — visible only on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:hidden"
          onClick={onMenuClick}
          aria-label="Apri menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {title ? <div className="text-sm font-medium">{title}</div> : <Breadcrumb />}
      </div>

      <div className="flex min-w-0 flex-[1.4] basis-0 justify-center px-2">
        <GlobalSearchField />
      </div>

      <div className="flex flex-1 basis-0 items-center justify-end gap-2">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Chiaro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Scuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-9 px-2 md:px-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-[11px] font-bold">
                {initials(userName)}
              </div>
              <span className="hidden sm:block text-sm font-medium max-w-32 truncate">
                {userName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/impostazioni")}>
              <User className="mr-2 h-4 w-4" /> Impostazioni
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
