"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Users, Plus, User, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { NewQuoteModal } from "@/components/quote-editor/NewQuoteModal";

type TabItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Match attivo aggiuntivo (sezioni che ricadono sotto questa tab) */
  match: (path: string) => boolean;
};

const TABS: TabItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: Home,
    match: (p) => p === "/dashboard" || p.startsWith("/dashboard"),
  },
  {
    href: "/clienti",
    label: "Clienti",
    icon: Users,
    match: (p) => p.startsWith("/clienti"),
  },
  {
    href: "/profilo",
    label: "Profilo",
    icon: User,
    match: (p) => p.startsWith("/profilo"),
  },
  {
    href: "/altro",
    label: "Altro",
    icon: LayoutGrid,
    // "Altro" raccoglie tutte le sezioni secondarie
    match: (p) =>
      p.startsWith("/altro") ||
      p.startsWith("/listino") ||
      p.startsWith("/template") ||
      p.startsWith("/cestino") ||
      p.startsWith("/impostazioni") ||
      p.startsWith("/utenti") ||
      p.startsWith("/admin"),
  },
];

function TabLink({ tab, active }: { tab: TabItem; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className="group flex flex-1 flex-col items-center justify-center gap-1 pt-1 transition-transform active:scale-90"
    >
      <span
        className={cn(
          "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
          active ? "bg-primary/10" : "bg-transparent"
        )}
      >
        <Icon
          className={cn(
            "h-[22px] w-[22px] transition-colors",
            active ? "text-primary" : "text-muted-foreground"
          )}
          strokeWidth={active ? 2.4 : 2}
        />
      </span>
      <span
        className={cn(
          "text-[10px] font-medium leading-none transition-colors",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = usePermissions();
  const [showNew, setShowNew] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  // Carica i clienti solo quando si apre il modale "Nuovo preventivo"
  useEffect(() => {
    if (showNew && clients.length === 0) {
      fetch("/api/clients")
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) =>
          setClients(
            (rows as { id: string; name: string }[]).map((c) => ({
              id: c.id,
              name: c.name,
            }))
          )
        )
        .catch(() => {});
    }
  }, [showNew, clients.length]);

  const canCreate = can.createQuote;

  // Senza "+" centrale: 4 tab equidistanti. Con "+": 2 tab | + | 2 tab.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-[var(--card)]/80 pb-safe backdrop-blur-xl lg:hidden"
        style={{ boxShadow: "var(--shadow-float)" }}
      >
        <div className="mx-auto flex h-[var(--mobile-tabbar-h)] max-w-lg items-stretch px-2">
          {canCreate ? (
            <>
              {left.map((tab) => (
                <TabLink key={tab.href} tab={tab} active={tab.match(pathname)} />
              ))}

              {/* Bottone centrale rialzato — Nuovo preventivo */}
              <div className="flex w-16 shrink-0 items-start justify-center">
                <button
                  type="button"
                  onClick={() => setShowNew(true)}
                  aria-label="Nuovo preventivo"
                  className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-700 text-white ring-4 ring-[var(--background)] transition-transform active:scale-90"
                  style={{ boxShadow: "var(--shadow-fab)" }}
                >
                  <Plus className="h-7 w-7" strokeWidth={2.6} />
                </button>
              </div>

              {right.map((tab) => (
                <TabLink key={tab.href} tab={tab} active={tab.match(pathname)} />
              ))}
            </>
          ) : (
            TABS.map((tab) => (
              <TabLink key={tab.href} tab={tab} active={tab.match(pathname)} />
            ))
          )}
        </div>
      </nav>

      {canCreate && (
        <NewQuoteModal
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            router.push(`/preventivi/${id}`);
          }}
          clients={clients}
        />
      )}
    </>
  );
}
