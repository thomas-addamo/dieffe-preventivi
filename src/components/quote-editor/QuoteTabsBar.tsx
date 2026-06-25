"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, FileText, LayoutDashboard } from "lucide-react";
import { useQuoteTabs } from "@/lib/stores/quote-tabs";
import { cn } from "@/lib/utils";

// Barra dei tab in stile editor (VS Code): un tab per ogni preventivo aperto,
// click per passare da uno all'altro, X per chiudere. Solo desktop (lg+): su
// mobile l'editor è immersivo a schermo singolo. Vive in un layout persistente
// (preventivi/[id]/layout.tsx) così NON si rimonta quando si cambia tab.
const BAR_H = "h-[2.375rem]"; // 38px — allineato con lg:top-[2.375rem] della toolbar editor

export function QuoteTabsBar() {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = useQuoteTabs((s) => s.tabs);
  const closeTab = useQuoteTabs((s) => s.closeTab);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const activeId = pathname.startsWith("/preventivi/") ? pathname.split("/")[2] : null;

  // Placeholder (stesso ingombro) finché non è montato o se non c'è alcun tab:
  // riserva lo spazio sotto cui si incolonna la toolbar dell'editor (lg:top).
  if (!mounted || tabs.length === 0) {
    return <div className={cn("hidden lg:block border-b bg-muted", BAR_H)} aria-hidden />;
  }

  function handleClose(id: string) {
    const idx = tabs.findIndex((t) => t.id === id);
    closeTab(id);
    if (id === activeId) {
      const next = tabs[idx + 1] ?? tabs[idx - 1];
      router.push(next ? `/preventivi/${next.id}` : "/dashboard");
    }
  }

  return (
    <div className={cn("sticky top-0 z-20 hidden lg:flex items-stretch border-b bg-muted", BAR_H)}>
      <button
        onClick={() => router.push("/dashboard")}
        title="Torna alla Dashboard"
        className="flex shrink-0 items-center justify-center border-r px-3 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <LayoutDashboard className="h-4 w-4" />
      </button>
      <div className="flex flex-1 items-stretch overflow-x-auto">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              title={t.title}
              onClick={() => router.push(`/preventivi/${t.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/preventivi/${t.id}`)}
              onAuxClick={(e) => {
                // tasto centrale del mouse = chiudi (come nei browser/editor)
                if (e.button === 1) {
                  e.preventDefault();
                  handleClose(t.id);
                }
              }}
              className={cn(
                "group relative flex max-w-[220px] shrink-0 cursor-pointer select-none items-center gap-2 border-r pl-3 pr-2 text-sm transition-colors",
                active
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate font-medium">{t.code}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(t.id);
                }}
                aria-label={`Chiudi ${t.code}`}
                className={cn(
                  "ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground",
                  active ? "opacity-70" : "opacity-0 group-hover:opacity-70"
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
