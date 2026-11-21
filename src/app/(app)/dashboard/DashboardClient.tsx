"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, FilePen, Lock, Phone, Plus, ReceiptText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page, SectionTitle } from "@/components/shared/Page";
import { useMenuParam } from "@/hooks/use-menu-param";
import { openGlobalSearch } from "@/components/shared/GlobalSearch";
import type { DashboardData, PendingItem } from "@/lib/dashboard";
import { cn, formatCurrency } from "@/lib/utils";
import { WelcomeBriefing } from "./WelcomeBriefing";

// Dashboard (C1): cosa fare adesso (riquadri colorati e cliccabili), i numeri
// del mese, cosa è in sospeso e i cantieri in corso. Niente elenco dei
// preventivi: sta nella pagina Preventivi.

const TONE = {
  orange: {
    box: "border-orange-200 bg-orange-50 hover:border-orange-300 dark:border-orange-900/60 dark:bg-orange-950/30",
    icon: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
    text: "text-orange-900 dark:text-orange-200",
  },
  blue: {
    box: "border-blue-200 bg-blue-50 hover:border-blue-300 dark:border-blue-900/60 dark:bg-blue-950/30",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    text: "text-blue-900 dark:text-blue-200",
  },
  green: {
    box: "border-green-200 bg-green-50 hover:border-green-300 dark:border-green-900/60 dark:bg-green-950/30",
    icon: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    text: "text-green-900 dark:text-green-200",
  },
  plain: {
    box: "border-border bg-card hover:border-primary/40",
    icon: "bg-muted text-foreground",
    text: "text-foreground",
  },
} as const;

function TodoCard({
  href,
  icon: Icon,
  value,
  label,
  tone,
}: {
  href: string;
  icon: React.ElementType;
  value: number;
  label: string;
  tone: keyof typeof TONE;
}) {
  const t = TONE[value === 0 ? "plain" : tone];
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 rounded-card border p-4 transition-colors active:scale-[0.99]", t.box)}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.icon)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className={cn("min-w-0 flex-1", t.text)}>
        <span className="block text-[22px] font-bold leading-tight tabular-nums">{value}</span>
        <span className="block text-[13px] leading-snug opacity-90">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
    </Link>
  );
}

function KpiCard({ href, label, value, note, noteClass }: { href: string; label: string; value: number; note: string; noteClass?: string }) {
  return (
    <Link href={href} className="surface block transition-colors hover:border-primary/40">
      <span className="block text-[13px] text-muted-foreground">{label}</span>
      <span className="mt-1 block text-[26px] font-bold leading-tight tabular-nums">{value}</span>
      <span className={cn("mt-1 block text-xs text-muted-foreground", noteClass)}>{note}</span>
    </Link>
  );
}

const BADGE: Record<PendingItem["kind"], string> = {
  unlock: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  expired: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  followup: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  sal: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
};

const monthName = (delta: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return new Intl.DateTimeFormat("it-IT", { month: "long" }).format(d);
};

export function DashboardClient({
  data,
  currentUser,
  canCreate,
}: {
  data: DashboardData;
  currentUser: { id: string; name: string };
  canCreate: boolean;
}) {
  const router = useRouter();
  // Comandi dell'app Mac già installata (menu che puntano ancora alla dashboard).
  useMenuParam("importa", () => router.push("/preventivi?importa=1"));
  useMenuParam("nuovo", () => router.push("/preventivi?nuovo=1"));
  useMenuParam("cerca", () => openGlobalSearch());

  const { todo, kpi } = data;
  const diff = kpi.acceptedThisMonth - kpi.acceptedLastMonth;
  const lastMonth = monthName(-1);

  return (
    <Page>
      <WelcomeBriefing
        userId={currentUser.id}
        userName={currentUser.name}
        actions={
          canCreate && (
            <div className="hidden gap-2 lg:flex">
              <Button variant="outline" asChild className="gap-2">
                <Link href="/preventivi?importa=1">
                  <Upload className="h-4 w-4" /> Importa da file
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link href="/preventivi?nuovo=1">
                  <Plus className="h-4 w-4" /> Nuovo preventivo
                </Link>
              </Button>
            </div>
          )
        }
      />

      <SectionTitle>Da fare adesso</SectionTitle>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TodoCard href="/preventivi?vista=scaduti" icon={Clock} value={todo.expired} tone="orange"
          label={todo.expired === 1 ? "preventivo scaduto, ancora «inviato»" : "preventivi scaduti, ancora «inviati»"} />
        <TodoCard href="/preventivi?vista=sollecitare" icon={Phone} value={todo.followup} tone="blue"
          label={todo.followup === 1 ? "cliente da richiamare (oltre 7 giorni)" : "clienti da richiamare (oltre 7 giorni)"} />
        {data.showSites && (
          <TodoCard href="/cantieri" icon={ReceiptText} value={todo.salToInvoice} tone="green"
            label={todo.salToInvoice === 0 ? "SAL da fatturare" : `SAL da fatturare · ${formatCurrency(todo.salAmount)}`} />
        )}
        {todo.unlockRequests !== null ? (
          <TodoCard
            href={data.pending.find((p) => p.kind === "unlock")?.href ?? "/preventivi"}
            icon={Lock} value={todo.unlockRequests} tone="orange"
            label={todo.unlockRequests === 1 ? "richiesta di sblocco" : "richieste di sblocco"} />
        ) : (
          <TodoCard href="/preventivi?stato=draft" icon={FilePen} value={kpi.drafts} tone="plain"
            label={kpi.drafts === 1 ? "bozza da completare" : "bozze da completare"} />
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:mb-6 xl:grid-cols-4">
        <KpiCard href="/preventivi?stato=sent" label="In attesa di risposta" value={kpi.pending}
          note={kpi.pendingOld ? `${kpi.pendingOld} da oltre 90 giorni` : "nessuno fermo da mesi"} />
        <KpiCard href="/preventivi?stato=accepted" label={`Accettati a ${monthName(0)}`} value={kpi.acceptedThisMonth}
          note={diff === 0 ? `come a ${lastMonth} (${kpi.acceptedLastMonth})` : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} rispetto a ${lastMonth} (${kpi.acceptedLastMonth})`}
          noteClass={diff > 0 ? "text-green-700 dark:text-green-400" : diff < 0 ? "text-amber-700 dark:text-amber-400" : undefined} />
        {data.showSites ? (
          <KpiCard href="/cantieri" label="Cantieri in corso" value={kpi.sitesActive}
            note={kpi.sitesPending ? `più ${kpi.sitesPending} da avviare` : "nessuno da avviare"} />
        ) : (
          <KpiCard href="/preventivi?stato=accepted" label="Accettati il mese scorso" value={kpi.acceptedLastMonth} note={lastMonth} />
        )}
        <KpiCard href="/preventivi?stato=draft" label="Bozze aperte" value={kpi.drafts} note="riprendi da dove eri rimasto" />
      </div>

      <div className={cn("grid gap-3", data.showSites && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
        <div className="surface !p-0">
          <p className="px-4 pb-1.5 pt-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">In sospeso</p>
          {data.pending.length === 0 ? (
            <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">Niente in sospeso: tutto in ordine.</p>
          ) : (
            <div className="divide-y border-t">
              {data.pending.map((p) => (
                <Link key={`${p.kind}-${p.id}`} href={p.href}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors last:rounded-b-card hover:bg-accent/50">
                  <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline", BADGE[p.kind])}>{p.badge}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="sm:hidden">{p.badge} · </span>
                      {p.subtitle}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-medium text-primary">{p.action}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {data.showSites && (
          <div className="surface !p-0">
            <p className="px-4 pb-1.5 pt-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cantieri in corso</p>
            {data.sites.length === 0 ? (
              <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">Nessun cantiere in corso.</p>
            ) : (
              <div className="divide-y border-t">
                {data.sites.map((s) => (
                  <Link key={s.id} href={`/cantieri/${s.id}`} className="block px-4 py-2.5 transition-colors last:rounded-b-card hover:bg-accent/50">
                    <span className="flex justify-between gap-3 text-sm font-medium">
                      <span className="truncate">{s.name}</span>
                      <span className="tabular-nums">{s.progress}%</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className={cn("block h-full rounded-full", s.progress >= 80 ? "bg-green-600" : "bg-primary")}
                        style={{ width: `${Math.max(2, s.progress)}%` }} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
